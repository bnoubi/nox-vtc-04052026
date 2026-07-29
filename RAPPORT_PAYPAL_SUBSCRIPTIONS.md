# Rapport — Migration PayPal Subscriptions API

**Date :** 2026-07-29  
**Build :** ✅ 0 erreur  
**Déployé :** ✅ PM2 online (pid 8321)

---

## Contexte

Le système PayPal précédent utilisait des **Orders one-time** (`/v2/checkout/orders`) pour les abonnements DUO/TEAM. Cela signifiait qu'aucun prélèvement automatique mensuel n'était effectué — l'utilisateur devait repayer manuellement chaque mois.

Migration vers l'**API PayPal Subscriptions** (`/v1/billing/plans`, `/v1/billing/subscriptions`) pour activer le prélèvement automatique récurrent, avec support du grandfathering (modification de prix sans impacter les abonnés existants).

---

## Fichiers créés

### `lib/paypal/subscriptions.ts`
Bibliothèque utilitaire PayPal Subscriptions API (LIVE mode : `api-m.paypal.com`) :
- `createPayPalProduct(code)` → crée un produit PayPal pour DUO ou TEAM
- `createPayPalPlan(productId, code, price)` → crée un billing plan mensuel
- `createPayPalSubscription(planId, userId)` → crée une souscription + retourne l'approval URL
- `getPayPalSubscription(subscriptionId)` → récupère le statut PayPal
- `cancelPayPalSubscription(subscriptionId, reason)` → annule (ignore 422 si déjà annulé)
- `verifyPayPalWebhookSignature(headers, body, webhookId)` → vérifie la signature via `/v1/notifications/verify-webhook-signature`

### `lib/actions/subscription-plans.ts`
Server Action pour lire les plans DUO/TEAM depuis la DB (`subscription_plans` table) :
- `getSubscriptionPlansAction()` → retourne `code, name, price_per_month, stripe_price_id, paypal_plan_id`

### `app/api/paypal/create-subscription/route.ts`
- Input : `{ itemType: 'plan_duo'|'plan_team', userId: UUID }`
- Auto-init : si `paypal_plan_id` est null en DB, crée automatiquement le Product + Plan PayPal
- Pré-insère un enregistrement `paypal_subscriptions` avec `status='pending'` (idempotence via UNIQUE constraint)
- Retourne `{ approvalUrl }` → redirect utilisateur vers PayPal

### `app/api/paypal/subscription-callback/route.ts`
- GET handler ; PayPal redirige ici avec `?subscription_id=I-XXX` après approbation
- Lookup `paypal_subscriptions` par `paypal_subscription_id` → retrouve `user_id` + `plan_code`
- Si statut PayPal = ACTIVE : active `paypal_subscriptions`, `subscriptions`, `user_accounts`
- Si APPROVAL_PENDING : log + le webhook prendra le relais
- Redirige vers `/payment/success?type=subscription&plan=...`

### `app/api/paypal/subscription-webhook/route.ts`
- Variable env `PAYPAL_WEBHOOK_ID` : si absente, skip vérification signature (avec warning)
- Événements gérés :
  - `BILLING.SUBSCRIPTION.ACTIVATED` → active la souscription
  - `PAYMENT.SALE.COMPLETED` → renouvelle `next_billing_date` + 30j
  - `BILLING.SUBSCRIPTION.CANCELLED` → plan → SOLO + email expiration
  - `BILLING.SUBSCRIPTION.SUSPENDED` → `account_status = 'suspended'`
  - `PAYMENT.SALE.DENIED` → même traitement que SUSPENDED
- Retourne toujours 200 pour éviter les retry loops PayPal

### `app/api/admin/subscription-plans/route.ts`
- `GET` → retourne plans DUO/TEAM (auth `config.write` requise)
- `PATCH { code, price_per_month }` → crée un nouveau Stripe Price (recurring/month) ET un nouveau PayPal Plan sur le même produit ; log dans `admin_logs`
- Si Stripe échoue → 500, DB non modifiée (atomicité partielle)
- Grandfathering : les abonnés existants conservent leur ancien `paypal_plan_id` dans `paypal_subscriptions`

### `app/admin/(protected)/subscriptions/_components/subscription-plans-manager.tsx`
Tableau admin DUO/TEAM avec :
- Colonnes : Plan, Prix/mois, Stripe Price ID (tronqué à 26 chars), PayPal Plan ID (tronqué), bouton Modifier
- Modal d'édition : champ prix uniquement + note grandfathering
- Design system `var(--admin-*)` identique au token-packs-manager

---

## Fichiers modifiés

### `components/dashboard/subscription-drawer.tsx`
- Supprimé `ORIGINAL_PRICES` hardcodé et `price` du `PLAN_DETAILS`
- Ajouté `DEFAULT_PRICES = { DUO: 4.99, TEAM: 9.99 }` comme fallback
- Ajouté `planPrices` state mis à jour via `useEffect` → `getSubscriptionPlansAction()`
- `handlePayPal` appelle désormais `/api/paypal/create-subscription` (au lieu de `/api/paypal/create-order`)

### `app/api/paypal/create-order/route.ts`
- Rejette `plan_duo` / `plan_team` avec message : _"Utilisez /api/paypal/create-subscription pour les abonnements"_
- Logique token packs conservée intacte
- Supprimé l'import inutilisé `getPlan`

### `app/api/paypal/capture-order/route.ts`
- Rejette `plan_duo` / `plan_team` dans `processCapture`
- Supprimé l'ancienne branche subscription (one-time PayPal Orders pour plans)
- Simplifié `handleSaasInvoicePaypal` → token packs uniquement
- Supprimé l'import inutilisé `getPlan`

### `app/api/subscription/cancel/route.ts`
- Ajouté branche PayPal : query `paypal_subscriptions` par `user_id` + `status=active`, appel `cancelPayPalSubscription()`
- La mise à jour DB (`cancel_at`) reste commune aux deux providers

### `app/admin/(protected)/subscriptions/page.tsx`
- Ajouté `<SubscriptionPlansManager />` au-dessus de `<SubscriptionsTable />`

### `lib/config/prices.ts`
- Ajouté `@deprecated` JSDoc sur `SUBSCRIPTION_PLANS` (conservé pour `getPlan()` / `limit-alert-modal.tsx`)

---

## SQL à exécuter dans Supabase SQL Editor

### Bloc 1 — Colonnes sur subscription_plans

```sql
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS paypal_plan_id   TEXT,
  ADD COLUMN IF NOT EXISTS paypal_product_id TEXT;
```

### Bloc 2 — Table paypal_subscriptions

```sql
CREATE TABLE IF NOT EXISTS paypal_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_subscription_id TEXT NOT NULL UNIQUE,
  plan_code             TEXT NOT NULL,        -- 'DUO' | 'TEAM'
  paypal_plan_id        TEXT NOT NULL,        -- ID du billing plan PayPal (grandfathering)
  status                TEXT NOT NULL DEFAULT 'pending',
  last_payment_date     TIMESTAMPTZ,
  next_billing_date     TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE paypal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON paypal_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "user_read_own" ON paypal_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER paypal_subscriptions_updated_at
  BEFORE UPDATE ON paypal_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Bloc 3 — Vérification

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND column_name IN ('paypal_plan_id', 'paypal_product_id');

SELECT COUNT(*) FROM paypal_subscriptions;
```

---

## Variable d'environnement à ajouter

Dans `.env.local` :

```
PAYPAL_WEBHOOK_ID=<webhook_id_depuis_paypal_dashboard>
```

À récupérer dans : PayPal Developer Dashboard → Webhooks → l'ID du webhook pointant vers `https://app.noxvtc.fr/api/paypal/subscription-webhook`

Événements à cocher :
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.DENIED`

---

## Grandfathering

Lors d'un changement de prix via l'admin :
1. Un nouveau Stripe Price est créé (old price archivé)
2. Un nouveau PayPal Plan est créé sur le même produit
3. La DB `subscription_plans` est mise à jour avec les nouveaux IDs
4. Les **nouveaux** abonnés utilisent le nouveau plan
5. Les **abonnés existants** conservent leur `paypal_plan_id` d'origine dans `paypal_subscriptions` → PayPal continue de les facturer à l'ancien tarif

---

## Architecture flux PayPal Subscriptions

```
1. Utilisateur clique "S'abonner PayPal"
   → POST /api/paypal/create-subscription { itemType, userId }
   → Auto-init Product/Plan si paypal_plan_id null en DB
   → INSERT paypal_subscriptions (status=pending)
   → Retourne { approvalUrl }

2. Utilisateur approuve sur PayPal
   → GET /api/paypal/subscription-callback?subscription_id=I-XXX
   → Si ACTIVE : active subscriptions + user_accounts
   → Redirect /payment/success

3. PayPal envoie webhook
   → POST /api/paypal/subscription-webhook
   → ACTIVATED / PAYMENT.SALE.COMPLETED / CANCELLED / SUSPENDED / DENIED
```

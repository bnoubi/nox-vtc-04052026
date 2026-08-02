# Audit de sécurité NoX VTC — Rapport final

Date : 2026-08-02

---

## Section 1 — RLS (Row Level Security)

**✅ RLS activé et politiques correctes sur :**
`drivers`, `vehicles`, `bcs`, `clients`, `compliance_documents` (SELECT/INSERT/UPDATE/DELETE scopés à `auth.uid() = user_id`), `profiles`, `user_accounts`, `invoices`, `support_tickets`, `notifications`, `notification_preferences`, `admin_logs`, `two_factor_codes`, `recurring_contracts`, `app_config`, `communication_logs`

**⚠️ Tables sans RLS confirmé dans les migrations :**
`subscriptions`, `wallets`, `token_transactions`, `saas_invoices`, `paypal_subscriptions`, `deleted_accounts_archive`
→ Ces tables sont accédées exclusivement via la service role key (qui bypass RLS par design), ce qui est correct. Mais si un bug laissait passer un client non-admin, ces tables seraient exposées sans filet.
**Correctif proposé :** `SELECT * FROM pg_policies WHERE tablename IN ('subscriptions','wallets','token_transactions','saas_invoices')` en console Supabase pour confirmer l'état réel, puis ajouter `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` si absent.

---

## Section 2 — IDOR (Insecure Direct Object Reference)

**⚠️ `/api/trip-request/notify-operator` — userId non authentifié**
La route accepte `userId` depuis le body sans vérifier de session. N'importe qui peut envoyer des emails de notification à n'importe quel opérateur enregistré en connaissant son UUID.
```typescript
// Aucun check de session — route publique intentionnelle pour le formulaire passager
const { data: { user } } = await adminSupabase.auth.admin.getUserById(userId)
```
→ Intentionnel (formulaire public), mais sans rate-limiting c'est un vecteur de spam email.
**Correctif proposé :** Rate limiting par IP (Nginx `limit_req`) ou Turnstile CAPTCHA sur le formulaire passager.

**⚠️ `/api/paypal/capture-order` — userId provient du body sans vérification de session**
L'endpoint POST (et GET redirect PayPal) accepte `userId` depuis le corps/querystring. Un attaquant peut capturer son propre ordre PayPal en spécifiant un autre `userId` → les jetons vont sur le compte cible.
→ Exploitation exige de payer réellement — risque financier pour l'attaquant nul, mais manipulation de comptes possible.
**Correctif proposé :** Ajouter un check de session (`supabase.auth.getUser()`) et valider que `userId === session.user.id`.

---

## Section 3 — Routes admin

**✅ Toutes les routes sous `/api/admin/`** utilisent `verifyAdminPermission()` qui effectue une double vérification : `supabase.auth.getUser()` (token JWT) + requête DB sur `user_roles`. Pas de décision purement côté client.

---

## Section 4 — Vérification des webhooks

**✅ Stripe — `app/api/stripe/webhook/route.ts`**
`constructEvent()` est appelé en premier, avant tout traitement. Signature invalide → 400 immédiat.

**🔴 PayPal subscriptions — `app/api/paypal/subscription-webhook/route.ts`**
→ **CORRECTIF APPLIQUÉ**

Avant :
```typescript
} catch (sigErr) {
  console.error('[paypal-webhook] signature verification error:', sigErr)
  // Ne pas bloquer si verification echoue — on loggue et on continue ← FAILLE
}
} else {
  console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID non configure — verification ignoree') // ← FAILLE
}
```

Après :
```typescript
} catch (sigErr) {
  console.error('[paypal-webhook] signature verification error:', sigErr)
  return NextResponse.json({ error: 'Erreur vérification signature' }, { status: 500 })
}
} else {
  console.error('[paypal-webhook] PAYPAL_WEBHOOK_ID non configure — webhook rejeté')
  return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 })
}
```
**Note :** S'assurer que `PAYPAL_WEBHOOK_ID` est bien dans `.env.local` en prod — sinon tous les webhooks PayPal seront désormais rejetés.

---

## Section 5 — Idempotence des paiements

**✅ Stripe**
Vérification de doublon via `stripe_payment_intent_id` dans `token_transactions` avant tout crédit de jetons.

**⚠️ PayPal capture-order**
Pas de vérification DB sur l'`orderID`. La protection implicite vient de l'API PayPal (capturer un ordre déjà capturé retourne une erreur). Mais un retry sur erreur réseau pourrait re-tenter avant que PayPal confirme.
**Correctif proposé :** Ajouter une colonne `paypal_order_id` sur `token_transactions` avec contrainte UNIQUE et vérifier avant d'insérer (même pattern que Stripe).

---

## Section 6 — Promo / Coupons

**⚠️ `app/api/stripe/checkout/route.ts`**
Le coupon promo est appliqué à tous les modes `subscription` sans vérification du plan actuel de l'utilisateur :
```typescript
if (promoActive && promoCouponId && mode === 'subscription') {
  sessionParams.discounts = [{ coupon: promoCouponId }]
}
```
→ Un utilisateur DUO ou TEAM qui passe à un autre plan bénéficierait du coupon SOLO s'il est actif.
**Correctif proposé (décision produit) :** Récupérer le plan actuel de l'utilisateur et n'appliquer le coupon que si `currentPlan === 'SOLO'`.

---

## Section 7 — Résiliation / Accès post-annulation

**✅ Stripe**
Annulation via `cancel_at_period_end: true` — l'accès est maintenu jusqu'à la fin de la période payée. Le webhook `customer.subscription.updated/deleted` met à jour le statut en DB.

**✅ PayPal**
`BILLING.SUBSCRIPTION.CANCELLED` remet le plan à SOLO immédiatement (comportement légèrement différent de Stripe — à vérifier si la sémantique souhaitée est identique).

---

## Section 8 — Authentification / Bruteforce

**✅ Supabase Auth** gère nativement le rate-limiting sur les tentatives de connexion.
**✅ Turnstile CAPTCHA** sur la page d'inscription.
**⚠️ Pas de rate-limiting applicatif** sur les endpoints sensibles hors auth (ex: `/api/trip-request/notify-operator`, `/api/paypal/capture-order`).
**Correctif proposé :** Nginx `limit_req_zone` sur les routes API critiques, ou middleware Upstash/Redis.

---

## Section 9 — Secrets et variables d'environnement

**✅** Aucun secret trouvé dans les composants client.
**✅** `.env.local` absent du dépôt git (`.gitignore` correct).
**✅** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` présent pour des Server Action IDs stables.

---

## Section 10 — Headers HTTP

**✅ CSP avec nonce par requête** — implémenté dans `middleware.ts` + `proxy.ts`.
**✅ HSTS, X-Frame-Options, X-Content-Type-Options** — gérés par Nginx (grade A+ securityheaders.com).
**✅** Pas de doublon app+Nginx nécessaire.

---

## Section 11 — Storage Supabase

**✅ Bucket `compliance_documents`**
RLS parfaite : SELECT/INSERT/UPDATE/DELETE scopés à `auth.uid() = user_id`. Aucun accès croisé possible.

**⚠️ Bucket `logos` — SELECT public**
`logos_select_public` : `USING (bucket_id = 'logos')` sans `auth.uid()`. Intentionnel (logos affichés sur le formulaire public de demande de trajet). À documenter pour éviter de réduire cette politique par erreur future.

**🔴 `app/api/enterprise/upload-logo/route.ts` — aucune validation MIME ni taille**
→ **CORRECTIF APPLIQUÉ**

Ajouté après le check `if (!file)` :
```typescript
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo

if (!ALLOWED_MIME.includes(file.type)) {
  return NextResponse.json({ error: "Type de fichier non autorisé (jpeg, png, webp, svg uniquement)" }, { status: 415 })
}
if (file.size > MAX_SIZE) {
  return NextResponse.json({ error: "Fichier trop volumineux (max 2 Mo)" }, { status: 413 })
}
```
Note : `file.type` est la valeur MIME fournie par le client — peut être falsifiée. Risque résiduel faible (Supabase ne sert pas un fichier PHP comme exécutable). Pour validation stricte : lire les magic bytes via le package `file-type`.

---

## Section 12 — Divers

**✅ Flag `?debug-promo=`**
N'affecte que les états UI (`shouldShow`, `scenario`). Aucun effet sur `promo_active` en DB ni sur les prix réels.

**⚠️ `npm audit` — 15 vulnérabilités (6 high)**
Packages concernés : `dompurify`, `next`, `sharp`, `brace-expansion`, `postcss`, `tar`.
**Correctif proposé :** `npm audit fix` (sans `--force`) puis rebuild. À tester en staging avant prod.

---

## Récapitulatif

| # | Point | Statut | Action |
|---|-------|--------|--------|
| 1 | RLS tables principales | ✅ | Vérifier 6 tables service-role en console Supabase |
| 2a | IDOR notify-operator | ⚠️ | Rate limiting à ajouter |
| 2b | IDOR capture-order userId | ⚠️ | Vérifier session (décision produit) |
| 3 | Routes admin | ✅ | — |
| 4 | Stripe webhook signature | ✅ | — |
| 4 | **PayPal webhook bypass** | 🔴 | **Correctif appliqué** |
| 5 | Idempotence Stripe | ✅ | — |
| 5 | Idempotence PayPal | ⚠️ | Ajouter colonne `paypal_order_id` UNIQUE |
| 6 | Promo sans check plan | ⚠️ | Filtrer sur plan SOLO (décision produit) |
| 7 | Résiliation Stripe | ✅ | — |
| 8 | Auth bruteforce | ✅ | — |
| 8 | Rate limiting endpoints | ⚠️ | Nginx `limit_req` à configurer |
| 9 | Secrets | ✅ | — |
| 10 | Headers HTTP | ✅ | — |
| 11 | Storage compliance_documents | ✅ | — |
| 11 | Logos bucket public | ⚠️ | Intentionnel — à documenter |
| 11 | **Upload logo sans validation** | 🔴 | **Correctif appliqué** |
| 12 | Debug promo flag | ✅ | — |
| 12 | npm audit 6 high | ⚠️ | `npm audit fix` à tester |

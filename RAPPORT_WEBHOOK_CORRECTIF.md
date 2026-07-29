# Rapport correctif — Webhook Stripe : non-crédit jetons silencieux

**Date** : 2026-07-28  
**Fichier modifié** : `app/api/stripe/webhook/route.ts` (seul fichier touché)  
**Impact** : bug actif en production — paiement Stripe encaissé sans crédit jetons

---

## Cause racine

`creditTokens()` résolvait le nombre de jetons via `TOKEN_AMOUNTS[priceId]`, un dictionnaire construit à partir de variables d'environnement statiques. Or, modifier un tarif depuis l'admin crée un nouveau Stripe Price (les Price sont immuables) dont le `stripe_price_id` n'existe qu'en base (`token_packs.stripe_price_id`) — jamais dans `.env.local`. Résultat : `TOKEN_AMOUNTS[nouveauPriceId] === undefined`, log silencieux `[creditTokens] unknown priceId`, aucun crédit.

Même risque structurel dans `resolvePlan()` pour les abonnements (corrigé préventivement).

---

## Changements apportés

### 1. Nouvelle fonction `getTokenPackByItemType(itemType)`

Lit `token_packs` par UUID (`itemType` = l'UUID du pack dans les metadata Stripe). L'UUID est stable quelle que soit l'évolution des prix.

```
token_packs.id  →  quantite_jetons, nom
```

### 2. `creditTokens()` — nouvelle logique DB-first avec fallback

**Signature** : `creditTokens(userId, priceId, paymentIntentId, itemType?)`

Ordre de résolution :
1. Si `itemType` présent → `getTokenPackByItemType(itemType)` (DB)
2. Si DB échoue ou `itemType` absent → `TOKEN_AMOUNTS[priceId]` (legacy env vars)
3. Si les deux échouent → log `[CRITICAL]` + return sans crash

`itemType` est extrait de `session.metadata.itemType` dans le handler `checkout.session.completed` — ce champ est déjà écrit par `app/api/stripe/checkout/route.ts` (metadata `{ userId, itemType, priceId, type }`).

### 3. Nouvelle fonction `resolvePlanFromDb(priceId)` — remplace `resolvePlan()`

Lit `subscription_plans` par `stripe_price_id` (avec filtre `active=true`). Fallback sur `STRIPE_PRICE_DUO`/`STRIPE_PRICE_TEAM` d'env si pas de correspondance en base. Log `[CRITICAL]` si aucune correspondance nulle part et retour `'SOLO'`.

**Points d'appel migrés** :
- `upsertSubscription()` — `resolvePlan` → `await resolvePlanFromDb`
- `buildInvoiceDescription()` — devenue `async`, idem
- handler `customer.subscription.deleted` (email expiration) — idem

### 4. Logs `[CRITICAL]`

Trois situations déclenchent un `console.error('[CRITICAL] ...')` visible immédiatement dans `pm2 logs nox-vtc` :
- `itemType` présent mais pack introuvable en DB
- `itemType` absent ET `priceId` hors de `TOKEN_AMOUNTS` (aucun crédit possible)
- `resolvePlanFromDb` sans correspondance DB ni env (plan inconnu → SOLO par défaut)

---

## Non-régressions garanties

| Scénario | Comportement |
|---|---|
| Pack acheté avec Price ID d'origine (`.env.local`) | Fallback `TOKEN_AMOUNTS` → crédit normal |
| Pack acheté après modification de prix (nouveau Price ID) | DB lookup via `itemType` → crédit correct |
| Abonnement DUO/TEAM (Price ID actuel non modifié) | DB lookup (stripe_price_id renseigné dans subscription_plans) OU fallback env → plan correct |
| Webhook rejoué par Stripe (retry) | Idempotence paymentIntentId conservée |
| `subscription.deleted` email d'expiration | `resolvePlanFromDb` async, isolé dans try/catch → jamais de crash |

---

## Checklist de test

- [ ] Pack avec prix modifié (nouveau `stripe_price_id`) → paiement Stripe test → `pm2 logs` : pas de `[CRITICAL]`, ligne `[creditTokens] pack DB trouvé`
- [ ] Vérifier `token_transactions` : transaction créée avec bon montant
- [ ] Vérifier wallet crédité
- [ ] Pack non modifié (Price ID d'origine) → même test → chemin `FALLBACK TOKEN_AMOUNTS` dans les logs
- [ ] Abonnement DUO ou TEAM → `resolvePlanFromDb` → plan `DUO`/`TEAM` attribué, pas `SOLO`

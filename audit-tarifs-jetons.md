# Audit — Gestion admin des tarifs de jetons

Date : 2026-07-27  
Branche : feat/admin-subdomain  
Auteur : audit automatisé (Claude Code)

---

## 1. Où sont actuellement définis les tarifs ?

### Source de vérité : `lib/config/prices.ts` (hardcodé)

Les trois packs sont définis dans un tableau TypeScript immuable (`readonly`) :

```
Pack Découverte  — 10 jetons — 2 €   — 0,20 €/doc — stripeEnvKey: STRIPE_PRICE_PACK_5
Pack Privilège   — 30 jetons — 4 €   — 0,13 €/doc — stripeEnvKey: STRIPE_PRICE_PACK_15
Pack Prestige    — 50 jetons — 5 €   — 0,10 €/doc — stripeEnvKey: STRIPE_PRICE_PACK_25
```

Chaque entrée contient : `id`, `name`, `tokens`, `price` (en €), `unit` (prix/doc affiché),
`badge`, `stripeEnvKey` (nom de la variable d'env pointant vers un Stripe Price ID),
`description`.

**Il n'existe aucune table Supabase pour les tarifs de jetons.** Tout changement requiert
un déploiement.

---

## 2. Cohérence affichage ↔ paiement réel

### Stripe

L'UI (`wallet-drawer.tsx`) affiche `pack.price` depuis `prices.ts`.  
La route `/api/stripe/checkout` ne transmet **pas** `pack.price` à Stripe — elle utilise
`process.env[pack.stripeEnvKey]` pour résoudre un Stripe Price ID, et c'est Stripe qui
détermine le montant à facturer depuis son propre catalogue.

**Conséquence** : le prix affiché en UI (`prices.ts`) et le prix réellement prélevé
(Stripe Dashboard) sont **deux sources distinctes**. Ils coïncident aujourd'hui, mais
rien dans le code ne garantit leur synchronisation. Une modification du prix dans
`prices.ts` sans mise à jour du Stripe Price correspondant crée une divergence silencieuse.

### PayPal

La route `/api/paypal/create-order` utilise `item.price.toFixed(2)` depuis `prices.ts`
pour définir le montant de la commande PayPal.

**Conséquence** : pour PayPal, `prices.ts` est la source de vérité réelle — modifier
`price` dans le fichier change effectivement le montant prélevé. C'est la situation
inverse de Stripe.

### Résumé

| Processeur | Montant prélevé défini par | Prix affiché en UI |
|---|---|---|
| Stripe | Stripe Dashboard (Price ID via env) | `prices.ts` → display seulement |
| PayPal | `prices.ts` → `item.price` | `prices.ts` → même source |

**C'est un risque de divergence existant**, particulièrement sur Stripe.

---

## 3. Statut de `promo_active`

### Verdict : connecté, mais uniquement sur les abonnements — orphelin pour les jetons

#### Ce qui fonctionne

`promo_active` est une clé dans `app_config`, lue à trois endroits :

- **`lib/hooks/usePromo.ts`** → fournit `{ active, percent, couponId }` à l'UI
- **`subscription-drawer.tsx`** → affiche le prix barré + prix promo
- **`tab-settings.tsx`** → affiche les prix promo sur les cards d'offres
- **`/api/stripe/checkout`** → applique `sessionParams.discounts = [{ coupon: promoCouponId }]`
  **uniquement si `mode === 'subscription'`**

La chaîne est complète pour les **abonnements** : toggle admin → `app_config` → UI →
Stripe checkout avec coupon.

#### Ce qui reste orphelin

- `promo_active` **n'affecte aucunement les packs de jetons** (ni l'affichage, ni le
  montant PayPal/Stripe). Un token pack acheté pendant une promo est payé plein tarif.
- Second risque : `promo_percent` (affiché en UI comme "−X%") et le taux réel du coupon
  Stripe (`promoCouponId`) doivent correspondre manuellement. Le code n'effectue aucune
  vérification. Une incohérence (affichage −30% / coupon Stripe −20%) est silencieuse.

---

## 4. Architecture recommandée pour des tarifs éditables depuis l'admin

### Option A — Nouvelle table `token_packs` (recommandé)

```sql
create table token_packs (
  id          text primary key,           -- 'pack_decouverte' | 'pack_privilege' | 'pack_prestige'
  name        text not null,
  tokens      integer not null,
  price_eur   numeric(8,2) not null,      -- prix PayPal ET affiché
  stripe_price_id text not null,          -- remplace STRIPE_PRICE_PACK_* dans .env
  unit_price  text not null,              -- '0,20' — calculé ou saisi
  badge       text,
  active      boolean not null default true,
  sort_order  integer not null default 0
);
```

**Avantages :**
- Modèle dédié, évolutif (ajout de packs, désactivation partielle, A/B prix)
- `stripe_price_id` directement dans la base → supprime la dépendance aux env vars
  `STRIPE_PRICE_PACK_*` et élimine la source de divergence Stripe/affichage
- Permet une interface admin CRUD complète (ajouter/désactiver des packs)
- Source unique pour l'UI et les deux processeurs de paiement

**Inconvénients :**
- Nécessite une migration SQL + suppression des env vars STRIPE_PRICE_PACK_*
- Les routes de paiement devront faire une lecture DB avant de créer la session
  (latence +1 requête, négligeable)
- Le webhook Stripe (`TOKEN_AMOUNTS`) mappe actuellement price_id → tokens en dur :
  il faudra le rendre dynamique (requête DB ou reconstruit depuis la table)

### Option B — Extension de `app_config`

Ajouter des clés `token_pack_decouverte_price`, `token_pack_privilege_tokens`, etc.
dans la table existante.

**Avantages :** aucune migration de schéma, cohérent avec `promo_active`.  
**Inconvénients :** `app_config` est une table clé/valeur string — pas de types,
pas de contraintes, interface admin complexe à construire proprement. Déconseillé
pour des données structurées avec plusieurs champs par entité.

### Recommandation

**Option A — table `token_packs` dédiée.** L'effort supplémentaire par rapport
à l'option B est minime (une migration, quelques routes à adapter) et la dette
technique évitée est significative. La table permet aussi, sans code supplémentaire,
de désactiver un pack sans déploiement.

---

## 5. Risque de rétroactivité lors d'un changement de tarif

### Stripe — risque nul

Stripe ne modifie jamais le prix d'une session de paiement déjà créée. Un `price_id`
pointe vers un objet Price immuable dans le catalogue Stripe. Pour changer le prix,
on crée un **nouveau Price** dans le Dashboard Stripe et on met à jour la référence.
Toute session initiée avant le changement conserve l'ancien montant.

### PayPal — risque nul en pratique

Le montant est fixé à la création de l'ordre PayPal (`/api/paypal/create-order`).
Si l'utilisateur a déjà cliqué "Payer via PayPal" et que le prix change avant qu'il
confirme sur le site PayPal, l'ordre existant sera capturé avec l'ancien montant.
Ce cas est pathologique et dure < 15 minutes (expiration des ordres PayPal).

### Soldes de jetons existants — risque nul

Les jetons déjà achetés sont en base (`wallets`) et ne sont pas affectés. Seuls
les futurs achats utilisent le nouveau prix.

### Conclusion

Un changement de tarif est **sans risque de rétroactivité** à condition de :
1. Créer un nouveau Stripe Price (ne jamais modifier un Price existant)
2. Mettre à jour la référence dans `token_packs.stripe_price_id`
3. Mettre à jour `token_packs.price_eur` pour PayPal simultanément

---

## Plan d'implémentation proposé

### Phase 1 — Migration base de données (SQL, exécuté par Bernard)

```sql
-- 1. Créer la table
create table token_packs (
  id              text primary key,
  name            text not null,
  tokens          integer not null,
  price_eur       numeric(8,2) not null,
  stripe_price_id text not null,
  unit_price      text not null,
  badge           text,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- 2. Injecter les données actuelles
insert into token_packs values
  ('pack_decouverte', 'Découverte', 10, 2.00, 'price_1Th5PQCuURFhvIp1ZNXNRrAc', '0,20', null,    true, 1, now()),
  ('pack_privilege',  'Privilège',  30, 4.00, 'price_1Th5RQCuURFhvIp1dU6dXqxE', '0,13', 'Le plus populaire', true, 2, now()),
  ('pack_prestige',   'Prestige',   50, 5.00, 'price_1Th5ieCuURFhvIp1qYf1eVbL', '0,10', 'Meilleure offre', true, 3, now());

-- 3. RLS : lecture publique (pour l'UI abonné), écriture service role uniquement
alter table token_packs enable row level security;
create policy "lecture publique" on token_packs for select using (true);
```

### Phase 2 — Adaptation du code (effort ~4h)

| Fichier | Changement |
|---|---|
| `lib/config/prices.ts` | Supprimer `TOKEN_PACKS` hardcodé. Garder les types et les fonctions helper (elles liront la DB). |
| `app/api/stripe/checkout` | Lire `stripe_price_id` depuis `token_packs` plutôt que `process.env[stripeEnvKey]` |
| `app/api/paypal/create-order` | Lire `price_eur` depuis `token_packs` |
| `app/api/stripe/webhook` | Rendre `TOKEN_AMOUNTS` dynamique (lookup DB par `stripe_price_id`) |
| `components/dashboard/wallet-drawer.tsx` | Charger les packs via une Server Action plutôt qu'un import statique |
| `.env.local` | Supprimer `STRIPE_PRICE_PACK_5/15/25` (devenus inutiles) |

### Phase 3 — Interface admin (effort ~3h)

Nouvelle section dans `/admin/settings` ou nouvelle page `/admin/tokens` :
- Tableau des packs avec prix, quantité, badge, état actif/inactif
- Édition inline du `price_eur` et du `stripe_price_id`
- Avertissement visible : "Modifier le Stripe Price ID nécessite de créer un nouveau
  Price dans le Dashboard Stripe au préalable"

### Phase 4 — Corriger la lacune promo jetons (effort ~1h, optionnel)

Si une promo sur les packs de jetons est souhaitée : appliquer un pourcentage de
réduction sur `price_eur` côté PayPal, et utiliser un coupon Stripe sur les paiements
`mode: 'payment'` (si Stripe le permet pour les one-time payments).

---

## Effort total estimé

| Phase | Effort |
|---|---|
| Migration SQL | 15 min (exécution Bernard) |
| Adaptation code | ~4h |
| Interface admin | ~3h |
| Tests + déploiement | ~1h |
| **Total** | **~8h de développement** |

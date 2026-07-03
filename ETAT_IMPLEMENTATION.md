# NoX VTC — État d'implémentation exhaustif
> Rédigé le 2026-06-26 pour transmission à un outil IA externe.  
> Ce document est la seule source de vérité disponible : l'IA destinataire n'a accès à aucune conversation précédente.

---

## 1. Vision produit

**NoX VTC** est une application SaaS B2B destinée aux chauffeurs VTC indépendants et petites flottes françaises. Elle permet de :
- Gérer administrativement leur activité (bons de commande, factures, clients, chauffeurs, véhicules)
- Générer des documents PDF conformes à la réglementation française (Article R3120-2 / Arrêté du 6 août 2025)
- Produire des factures Factur-X (norme européenne de facturation électronique, XML embarqué dans le PDF)
- Envoyer un lien public à un passager pour qu'il remplisse lui-même les détails de sa course (trip requests)
- Gérer des contrats récurrents avec génération automatique des courses
- Payer des jetons (tokens) pour générer des documents
- S'abonner à un plan mensuel (Starter/Pro/Premium)

---

## 2. Stack technique

| Couche | Choix |
|---|---|
| Framework | **Next.js 16 (App Router)**, React 19, TypeScript 5.7 strict |
| UI | **Tailwind CSS 3**, Radix UI (shadcn/ui), Framer Motion, Lucide React |
| Backend/Auth/DB | **Supabase** (PostgreSQL + Auth + Storage + RLS + pg_cron) |
| PDF | **jsPDF** + **pdf-lib** (Factur-X embedding) |
| Email | **Resend** (JSX templates React Email) |
| Paiement | **Stripe** (abonnements + packs de jetons) + **PayPal** (checkout alternatif) |
| Maps/Géo | **Google Maps API** (Places Autocomplete, Directions, Static Maps) |
| Monitoring | **Sentry** (installé via wizard mais config minimale) |
| Anti-bot | **Cloudflare Turnstile** (sur /register) |
| Serveur | **VPS Ubuntu**, **Nginx**, **PM2** |
| Consentement | **Axeptio** (widget cookies RGPD) |

### Variables d'environnement requises
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_DUO          # price_id Stripe abonnement Pro (4,99€/mois)
STRIPE_PRICE_TEAM         # price_id Stripe abonnement Premium (9,99€/mois)
STRIPE_PRICE_PACK_5       # price_id pack Découverte (10 jetons, 2€)
STRIPE_PRICE_PACK_15      # price_id pack Privilège (30 jetons, 4€)
STRIPE_PRICE_PACK_25      # price_id pack Prestige (50 jetons, 5€)
RESEND_API_KEY
CRON_SECRET               # header x-cron-secret pour sécuriser les routes /api/cron/*
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY  # Server Actions IDs stables
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
```

---

## 3. Infrastructure & déploiement

- **Serveur** : VPS Ubuntu, Nginx en reverse proxy
- **Process manager** : PM2 (process nommé `nox-vtc`)
- **Séquence de déploiement** : `npm run build && pm2 stop nox-vtc && pm2 start nox-vtc && pm2 save`  
  ⚠️ Ne jamais utiliser `pm2 restart` — toujours `stop` puis `start`
- **Git** : deux remotes — `origin` (nox-vtc-04052026) et `guard` (nox-vtc-guard-11052026)  
  Toujours pousser sur les deux : `git push origin main && git push guard HEAD:main`
- **Middleware** : `proxy.ts` (Next.js middleware) gère CSP nonce par requête + protection routes admin + session Supabase
- **Sécurité** : headers Nginx grade A+ (securityheaders.com), TypeScript strict 0 erreur, Zod sur les routes POST, RLS Supabase

---

## 4. Structure des fichiers clés

```
/
├── app/
│   ├── page.tsx                    # Dashboard principal (SPA)
│   ├── layout.tsx                  # Layout global (ThemeProvider, Axeptio)
│   ├── login/page.tsx              # Page de connexion
│   ├── register/page.tsx           # Inscription (magic link uniquement)
│   ├── auth/
│   │   ├── callback/route.ts       # Handler OAuth/OTP → redirect dashboard
│   │   ├── actions.ts              # Server actions auth
│   │   ├── confirmed/page.tsx
│   │   └── reset-password/page.tsx
│   ├── admin/                      # Back-office admin (voir §11)
│   ├── api/                        # Routes API (voir §12)
│   └── request/[token]/            # Formulaire public passager
├── components/
│   ├── OnboardingComponent.tsx     # Onboarding 7 étapes
│   ├── AuthScreen.tsx
│   ├── dashboard/
│   │   ├── data.ts                 # Types TypeScript + helpers conformité
│   │   ├── nox-context.tsx         # Context React central (état + CRUD Supabase)
│   │   ├── tab-dashboard.tsx       # Onglet tableau de bord
│   │   ├── tab-documents.tsx       # Onglet BCs + Factures
│   │   ├── tab-clients.tsx         # Onglet clients
│   │   ├── tab-calendar.tsx        # Onglet calendrier/planning
│   │   ├── tab-settings.tsx        # Onglet réglages
│   │   ├── create-bc.tsx           # Formulaire création BC
│   │   ├── create-invoice.tsx      # Formulaire création facture
│   │   ├── recurring-screen.tsx    # Gestion contrats récurrents
│   │   ├── cgv-settings.tsx        # Réglages CGV
│   │   ├── tarifs-settings.tsx     # Grille tarifaire
│   │   └── ...                     # Drawers, modales, widgets
│   └── ui/                         # Composants shadcn/ui + PlacesAutocomplete
├── lib/
│   ├── pdf-generator.ts            # Génération PDF BC + Factures (53 KB)
│   ├── facturx-builder.ts          # Embedding XML Factur-X dans PDF
│   ├── facturx-xml.ts              # Génération XML Factur-X
│   ├── facturx-embed.ts
│   ├── plans.ts                    # Helpers plans/abonnements
│   ├── convert-bc-to-invoice.ts    # Conversion BC → Facture
│   ├── config/prices.ts            # TOKEN_PACKS + SUBSCRIPTION_PLANS
│   └── supabase/                   # Clients Supabase (server/client/middleware)
├── emails/                         # Templates Resend (JSX)
│   ├── welcome.tsx
│   ├── trial-start.tsx
│   ├── trial-ending.tsx
│   ├── subscription-cancelled.tsx
│   └── tokens-credited.tsx
├── supabase/migrations/            # 45+ migrations versionnées
└── proxy.ts                        # Middleware Next.js
```

---

## 5. Schéma base de données Supabase (PostgreSQL)

### 5.1 `public.profiles` — Profil entreprise / émetteur
Table principale des données entreprise du chauffeur VTC.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant interne |
| `user_id` | UUID UNIQUE FK→auth.users | Un profil par utilisateur |
| `statut_juridique` | TEXT | Ex: "SASU", "Micro-Entreprise", "EURL" |
| `nom_entreprise` | TEXT | Raison sociale ou nom commercial |
| `siret` | TEXT | SIRET (index UNIQUE partiel, ignore NULL) |
| `tva` | TEXT | Numéro de TVA intracommunautaire |
| `adresse` | TEXT | Adresse du siège |
| `code_postal` | TEXT | Code postal |
| `ville` | TEXT | Ville |
| `complement_adresse` | TEXT | Complément d'adresse |
| `pays` | TEXT DEFAULT 'France' | Pays |
| `telephone` | TEXT | Téléphone de contact |
| `email` | TEXT | Email professionnel |
| `registre_vtc` | TEXT | Numéro EVTC (Registre VTC) |
| `date_registre_vtc` | DATE | Date d'inscription au registre VTC |
| `date_assurance_pro` | DATE | Date d'assurance responsabilité pro |
| `banque` | TEXT | Nom de la banque |
| `iban` | TEXT | IBAN pour facturation |
| `bic` | TEXT | Code BIC |
| `logo_url` | TEXT | URL logo dans Supabase Storage |
| `brand_color` | TEXT | Couleur hex de marque (PDF) |
| `prenom_representant_legal` | TEXT | Prénom du gérant |
| `nom_representant_legal` | TEXT | Nom du gérant |
| `cgv_mode` | TEXT | Mode CGV : "configurator" \| "freetext" \| "import" |
| `cgv_config` | JSONB | Config CGV structurée (voir type CGVConfig) |
| `cgv_text` | TEXT | Texte CGV libre ou importé |
| `onboarding_status` | TEXT NOT NULL DEFAULT 'not_started' | Source de vérité statut onboarding |
| `status` | TEXT NOT NULL DEFAULT 'active' | Statut compte : 'active' \| 'deleted' |
| `deleted_at` | TIMESTAMPTZ | Date de suppression douce |
| `legal_rep_confirmed_at` | TIMESTAMPTZ | Date de confirmation identité représentant légal |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | Mis à jour par trigger |

> **RLS** : `profiles_select_own`, `profiles_update_own` — auth.uid() = user_id  
> **Trigger** : `set_profiles_updated_at` — updated_at auto  
> **Colonnes absentes de la migration initiale mais présentes en prod via alters** : `cgv_mode`, `cgv_config`, `cgv_text` (Lot 3A), `onboarding_status` (20260523), `status`/`deleted_at` (20260522), `legal_rep_confirmed_at` (20260620)

> **⚠️ COLONNES EN ATTENTE** :
> - `is_micro_entrepreneur BOOLEAN DEFAULT false` — codé dans le contexte mais migration **non exécutée**
> - En attendant, `isMicroEntrepreneur` est déduit de `statut_juridique` via `getVatFromStatut()`

---

### 5.2 `public.user_accounts` — Compte utilisateur applicatif
Données non-auth séparées de `auth.users`.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | = auth.users.id |
| `email` | TEXT NOT NULL | Email principal |
| `full_name` | TEXT | Nom complet (Google OAuth) |
| `plan` | TEXT NOT NULL DEFAULT 'SOLO' | Plan actif : 'SOLO' \| 'DUO' \| 'TEAM' (insensible casse depuis 20260625) |
| `tokens` | INTEGER NOT NULL DEFAULT 0 | Nombre de jetons disponibles |
| `onboarding_status` | TEXT NOT NULL DEFAULT 'not_started' | 'not_started' \| 'in_progress' \| 'completed' |
| `onboarding_step` | INTEGER NOT NULL DEFAULT 0 | Numéro de l'étape en cours (0-7) |
| `phone` | TEXT | Téléphone |
| `prenom` | TEXT | Prénom |
| `nom` | TEXT | Nom |
| `account_status` | TEXT NOT NULL DEFAULT 'active' | 'active' \| 'suspended' \| 'deleted' |
| `welcome_emails_sent_at` | TIMESTAMPTZ | Idempotence emails bienvenue |
| `cgu_accepted_at` | TIMESTAMPTZ | Date d'acceptation des CGU (étape finale onboarding) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Mis à jour par trigger |

> **Triggers** :  
> - `on_auth_user_created` → `handle_new_user_account()` : crée la ligne à l'inscription (avec RAISE WARNING si erreur, jamais silencieux)
> - `on_auth_user_login` → `ensure_user_bootstrap()` : crée les 3 lignes applicatives à chaque connexion (idempotent ON CONFLICT DO NOTHING)

---

### 5.3 `public.subscriptions` — Abonnements
Gestion des plans payants et de la période d'essai.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID UNIQUE FK→auth.users | Un abonnement par user |
| `plan` | TEXT | 'solo' \| 'duo' \| 'team' (insensible casse depuis 20260625) |
| `status` | TEXT | 'trial' \| 'active' \| 'suspended' \| 'expired' \| 'deleted' |
| `trial_started_at` | TIMESTAMPTZ | Début de la période d'essai |
| `trial_ends_at` | TIMESTAMPTZ | Fin de la période d'essai (14 jours) |
| `target_plan` | TEXT NOT NULL DEFAULT 'solo' | Plan cible après expiration essai |
| `pending_plan` | TEXT | Plan en attente de downgrade |
| `pending_at` | TIMESTAMPTZ | Date du downgrade pendng |
| `trial_ending_email_sent_at` | TIMESTAMPTZ | Idempotence email "essai se termine J-2" |
| `current_period_start` | TIMESTAMPTZ | Début période actuelle (Stripe) |
| `current_period_end` | TIMESTAMPTZ | Fin période actuelle (Stripe) |

> **Plan d'essai** : 14 jours en plan TEAM (Premium) dès l'inscription  
> **Expiration** : fonction `expire_trials()` appelée par pg_cron à 02:00 UTC + route `/api/cron/expire-trials`  
> **Webhook Stripe** : gère `checkout.session.completed` (tokens + plan) et `customer.subscription.*`

---

### 5.4 `public.wallets` — Portefeuille de jetons
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID UNIQUE FK→auth.users | |
| `balance` | INTEGER DEFAULT 0 | Solde de jetons |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> Créé automatiquement à l'inscription via `handle_new_user_wallet()` trigger.

---

### 5.5 `public.token_transactions` — Historique des transactions de jetons
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | |
| `amount` | INTEGER | Montant (positif = crédit, négatif = débit) |
| `type` | TEXT | 'credit' \| 'debit' |
| `stripe_payment_intent_id` | TEXT | Pour idempotence webhook Stripe |
| `created_at` | TIMESTAMPTZ | |

---

### 5.6 `public.clients` — Clients de l'opérateur VTC
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | Appartient au chauffeur |
| `type` | TEXT DEFAULT 'particulier' | 'particulier' \| 'professionnel' |
| `civilite` | TEXT | 'M.' \| 'Mme' |
| `nom` | TEXT | Nom (particulier) |
| `prenom` | TEXT | Prénom (particulier) |
| `raison_sociale` | TEXT | Raison sociale (professionnel) |
| `siren` | TEXT | SIREN (professionnel) |
| `tva_intra` | TEXT | TVA intracommunautaire (professionnel) |
| `email` | TEXT | Email |
| `telephone` | TEXT | Téléphone |
| `adresse` | TEXT | Adresse |
| `code_postal` | TEXT | Code postal |
| `ville` | TEXT | Ville |
| `pays` | TEXT DEFAULT 'France' | Pays |
| `contacts` | JSONB DEFAULT '[]' | Contacts associés (clients professionnels) : `[{id, prenom, nom, phone}]` |
| `tag` | TEXT | 'VIP' \| 'Régulier' |
| `preferences` | TEXT | Préférences passager (accueil personnalisé) |
| `trips` | INTEGER DEFAULT 0 | Nombre de courses |
| `last_trip` | TEXT | Date dernière course |
| `notes` | TEXT | Notes libres |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> **RLS** : users ne voient que leurs propres clients  
> **Route API** : `POST /api/clients/create` avec validation Zod

---

### 5.7 `public.drivers` — Chauffeurs de la flotte
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | Appartient à l'opérateur |
| `name` | TEXT | Nom complet affiché |
| `initials` | TEXT | Initiales (ex: "JD") |
| `online` | BOOLEAN DEFAULT false | Disponibilité |
| `carte_pro_expiration` | DATE | Expiration carte professionnelle VTC |
| `carte_pro_number` | TEXT | Numéro de carte pro VTC |
| `apac_expiration` | DATE | Expiration APAC (Attestation Préfectorale) |
| `apac_number` | TEXT | Numéro APAC |
| `rc_pro_expiration` | DATE | Expiration RC Professionnelle |
| `rc_pro_number` | TEXT | Numéro RC Pro |
| `phone` | TEXT | Téléphone |
| `email` | TEXT | Email |
| `permis_number` | TEXT | Numéro de permis |
| `permis_expiration` | DATE | Expiration permis |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> **RLS** : `rls_policies_drivers.sql` — users ne voient que leurs chauffeurs  
> **Limites plan** : SOLO = 1 chauffeur, DUO = 2, TEAM = 10

---

### 5.8 `public.vehicles` — Véhicules de la flotte
Table créée initialement via dashboard Supabase, enrichie par migrations.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | |
| `modele` | TEXT | Modèle du véhicule |
| `immatriculation` | TEXT | Plaque d'immatriculation |
| `in_service` | BOOLEAN DEFAULT false | En service |
| `date_mise_en_circulation` | DATE | Première immatriculation |
| `type_energie` | TEXT | 'diesel' \| 'essence' \| 'hybride' \| 'electrique' |
| `category` | TEXT | 'citadine' \| 'berline' \| 'suv' \| 'van' |
| `color` | TEXT | Couleur |
| `marque` | TEXT | Marque (Renault, Mercedes...) |
| `assurance_transport_expiration` | DATE | Expiration assurance transport onéreux |
| `controle_technique_expiration` | DATE | Expiration contrôle technique |
| `motorisation` | TEXT | Motorisation (Diesel 2.0 HDI...) |
| `co2` | INTEGER | Émissions CO₂ (g/km) |
| `cylindree` | INTEGER | Cylindrée (cm³) |

> **Données de référence** : `supabase/vehicles.csv` (~20 Mo) et `vehicles.xml` (~109 Mo) — catalogue de véhicules pour l'autocomplétion dans l'onboarding

---

### 5.9 `public.bcs` — Bons de Commande (documents légaux VTC)
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | |
| `number` | TEXT NOT NULL | Numéro séquentiel (ex: "BC-2026-0001") |
| `client` | TEXT | Nom du client payeur |
| `client_phone` | TEXT | Téléphone client |
| `client_id` | UUID FK→clients | Référence client payeur |
| `client_nom` | TEXT | Nom (colonne réelle en prod) |
| `client_telephone` | TEXT | Tel (colonne réelle en prod) |
| `passager_nom` | TEXT | Nom du passager transporté (peut ≠ client) |
| `passager_telephone` | TEXT | Téléphone passager |
| `driver_nom` | TEXT | Nom du chauffeur |
| `driver_carte_vtc` | TEXT | Numéro carte professionnelle chauffeur |
| `vehicle_nom` | TEXT | Désignation véhicule |
| `vehicle_immatriculation` | TEXT | Immatriculation |
| `amount` | NUMERIC | Montant TTC |
| `amount_ht` | NUMERIC | Montant HT |
| `tva` | NUMERIC | Montant TVA |
| `tva_rate` | NUMERIC | Taux TVA |
| `base_ht` | NUMERIC | Base HT (avant remise et suppléments) |
| `tva_10_amount` | NUMERIC | TVA à 10% |
| `supplements_ht` | NUMERIC | Suppléments HT |
| `tva_20_amount` | NUMERIC | TVA à 20% |
| `tva_55_amount` | NUMERIC | TVA à 5,5% |
| `tva_other_amount` | NUMERIC | Autre TVA |
| `discount_value` | NUMERIC | Valeur de remise |
| `discount_type` | TEXT | 'percent' \| 'amount' |
| `original_ht` | NUMERIC | HT avant remise |
| `original_ttc` | NUMERIC | TTC avant remise |
| `supplements_list` | JSONB | Détail suppléments : `[{label, montant, tva_rate}]` |
| `date` | DATE | Date d'émission |
| `status` | TEXT | Statut (contrainte CHECK, voir ci-dessous) |
| `type` | TEXT DEFAULT 'bc' | Type de document |
| `trajet` | JSONB | `{depart, arrivee, distance, duree, date, time, passengers, luggage, stops[], stops_optimized}` |
| `notes` | TEXT | Notes internes |
| `cgv_text` | TEXT | Texte CGV inclus dans le BC |
| `cgv_inclure` | BOOLEAN DEFAULT true | Inclure les CGV dans le PDF |
| `montant_ttc` | NUMERIC | Alias amount (noms réels colonnes Supabase) |
| `montant_ht` | NUMERIC | Alias amount_ht |
| `date_emission` | DATE | Alias date |
| `created_at` | TIMESTAMPTZ | |

**Statuts BC** (contrainte CHECK) : `'brouillon' | 'en_attente' | 'confirme' | 'en_cours' | 'termine' | 'annule_client' | 'annule_chauffeur'`

> **Règles métier critiques** :
> - `client_id` = payeur (référence `public.clients`)
> - `passager_nom`/`passager_telephone` = personne physiquement transportée (peut différer du payeur)
> - Le numéro EVTC (REVTC) n'est **jamais** stocké dans `bcs` — il est toujours lu depuis `public.profiles.registre_vtc`
> - Pas de suppression physique des BCs — annulation par changement de statut uniquement
> - Nouveaux BCs créés avec `status = 'en_attente'` (pas 'brouillon')
> - Auto-save brouillon : `saveDraftBC()` appelé automatiquement toutes les 30 secondes

---

### 5.10 `public.invoices` — Factures
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | |
| `numero` | TEXT NOT NULL | Numéro séquentiel (ex: "F-2026-001", généré par `generate_fac_numero()`) |
| `client_nom` | TEXT | Nom client |
| `client_telephone` | TEXT | Téléphone client |
| `client_id` | UUID | Référence client |
| `montant_ttc` | NUMERIC | Montant TTC |
| `montant_ht` | NUMERIC | Montant HT |
| `tva` | NUMERIC | Montant TVA |
| `tva_rate` | NUMERIC | Taux TVA |
| `items` | JSONB | Lignes de facture : `[{designation, amountHT, tvaRate, quantite}]` |
| `base_ht` | NUMERIC | |
| `tva_10_amount` | NUMERIC | |
| `supplements_ht` | NUMERIC | |
| `tva_20_amount` | NUMERIC | |
| `tva_5_5_amount` | NUMERIC | |
| `tva_other_amount` | NUMERIC | |
| `discount_value` | NUMERIC | |
| `discount_type` | TEXT | |
| `original_ht` | NUMERIC | |
| `original_ttc` | NUMERIC | |
| `date` | DATE | Date d'émission |
| `echeance` | DATE | Date d'échéance |
| `status` | TEXT | 'brouillon' \| 'envoyee' \| 'payee' |
| `type` | TEXT DEFAULT 'facture' | |
| `bc_ref` | TEXT | Numéro du BC source (si conversion) |
| `bc_id` | UUID | Référence UUID BC source |
| `trajet` | JSONB | Même structure que bcs.trajet |
| `passager_nom` | TEXT | |
| `passager_telephone` | TEXT | |
| `driver_name` | TEXT | |
| `driver_phone` | TEXT | |
| `driver_carte_vtc` | TEXT | |
| `vehicle_name` | TEXT | |
| `vehicle_plate` | TEXT | |
| `vehicle_type_energie` | TEXT | |
| `supplements_list` | JSONB | |
| `client_type` | TEXT | 'particulier' \| 'professionnel' |
| `client_siren` | TEXT | |
| `client_address` | JSONB | `{rue, codePostal, ville, pays}` |
| `notes` | TEXT | |
| `cgv_text` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

> **Séquence SQL** : `fac_numero_seq` + fonction `generate_fac_numero()` → "F-2026-001"  
> **Factur-X** : XML CII (Cross Industry Invoice) embarqué dans le PDF via `pdf-lib`

---

### 5.11 `public.trip_requests` — Demandes de course (formulaire public)
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | Opérateur qui a créé le lien |
| `token` | TEXT UNIQUE | Token URL (lien public `/request/{token}`) |
| `expires_at` | TIMESTAMPTZ | Expiration du lien |
| `used_at` | TIMESTAMPTZ | Date d'utilisation |
| `status` | TEXT | 'pending' \| 'filled' \| 'converted' \| 'expired' \| 'cancelled' |
| `passenger_civility` | TEXT | Civilité passager |
| `passenger_firstname` | TEXT | Prénom passager |
| `passenger_lastname` | TEXT | Nom passager |
| `passenger_phone` | TEXT | Téléphone passager |
| `passenger_email` | TEXT | Email passager |
| `departure` | TEXT | Adresse de départ |
| `arrival` | TEXT | Adresse d'arrivée |
| `stops` | TEXT[] | Arrêts intermédiaires |
| `trip_date` | TEXT | Date de la course |
| `trip_time` | TEXT | Heure de la course |
| `passengers_count` | INTEGER | Nombre de passagers |
| `luggage_count` | INTEGER | Nombre de bagages |
| `notes` | TEXT | Notes passager |
| `language` | TEXT | Langue du formulaire ('fr' \| 'en') |
| `bc_id` | UUID | BC créé depuis cette demande |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> **RLS anon** : utilisateurs non connectés peuvent lire (filter token) et mettre à jour (status pending→filled) — politique explicite pour le formulaire public passager  
> **Page publique** : `/app/request/[token]/page.tsx` — Server Component qui charge la demande et le profil opérateur, puis rend le formulaire client `TripRequestForm`

---

### 5.12 `public.recurring_contracts` — Contrats de transport récurrents
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→auth.users | |
| `numero` | TEXT | "RC-2026-06-0001" (séquence `rc_numero_seq`) |
| `label` | TEXT | Libellé du contrat |
| `notes` | TEXT | Notes |
| `passenger_name` | TEXT | Nom passager habituel |
| `passenger_phone` | TEXT | Téléphone passager |
| `client_id` | UUID | Client payeur |
| `departure` | TEXT NOT NULL | Adresse de départ habituelle |
| `arrival` | TEXT NOT NULL | Adresse d'arrivée habituelle |
| `outbound_days` | INTEGER[] | Jours aller (0=dim, 1=lun, ..., 6=sam) |
| `outbound_time` | TEXT | Heure départ aller |
| `return_enabled` | BOOLEAN DEFAULT false | Retour activé |
| `return_days` | INTEGER[] | Jours retour |
| `return_time` | TEXT | Heure retour |
| `return_departure` | TEXT | Départ retour |
| `return_arrival` | TEXT | Arrivée retour |
| `recurrence_type` | TEXT DEFAULT 'fixed' | Type de récurrence |
| `price_per_trip` | NUMERIC(10,2) | Prix par course |
| `billing_mode` | TEXT DEFAULT 'monthly_invoice' | Mode de facturation |
| `billing_frequency` | TEXT | 'monthly' \| 'weekly' \| 'manual' |
| `start_date` | DATE | Date de début |
| `end_date` | DATE | Date de fin (NULL si `no_end_date`) |
| `no_end_date` | BOOLEAN DEFAULT false | Contrat sans fin |
| `exclude_holidays` | BOOLEAN DEFAULT true | Exclure les jours fériés |
| `country_code` | TEXT DEFAULT 'FR' | Code pays |
| `excluded_dates` | TEXT[] | Dates exclues manuellement |
| `stops` | JSONB | Arrêts par jour de semaine |
| `status` | TEXT DEFAULT 'active' | 'active' \| 'paused' \| 'terminated' |
| `distance_km` | INTEGER | Distance en km |
| `driver_id` | UUID | Chauffeur assigné |
| `driver_name` | TEXT | |
| `vehicle_id` | UUID | Véhicule assigné |
| `vehicle_info` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

---

### 5.13 `public.recurring_trips` — Courses générées depuis contrats récurrents
Générées automatiquement par pg_cron ou par l'opérateur depuis l'interface.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `contract_id` | UUID FK→recurring_contracts | |
| `trip_date` | DATE | Date de la course |
| `trip_time` | TEXT | Heure |
| `status` | TEXT | 'scheduled' \| 'completed' \| 'missed' \| 'cancelled' |
| `created_at` | TIMESTAMPTZ | |

---

### 5.14 `public.support_tickets` — Tickets de support
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL FK→auth.users | |
| `subject` | TEXT NOT NULL | Sujet du ticket |
| `subject_category` | TEXT NOT NULL | Catégorie |
| `subject_custom` | TEXT | Catégorie personnalisée |
| `status` | TEXT DEFAULT 'open' | 'open' \| 'in_progress' \| 'closed' |
| `priority` | TEXT DEFAULT 'normal' | 'low' \| 'normal' \| 'high' |
| `messages` | JSONB DEFAULT '[]' | Fil de messages : `[{role, content, created_at}]` |
| `attachment_url` | TEXT | URL pièce jointe |
| `resolved_at` | TIMESTAMPTZ | Date de résolution |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 5.15 `public.notifications` — Notifications in-app
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL FK→auth.users | |
| `type` | TEXT NOT NULL | Type de notification |
| `title` | TEXT NOT NULL | Titre |
| `message` | TEXT NOT NULL | Message |
| `data` | JSONB DEFAULT '{}' | Données supplémentaires |
| `read` | BOOLEAN DEFAULT false | Lu/non lu |
| `created_at` | TIMESTAMPTZ | |

> Index : `(user_id, read, created_at DESC)` pour chargement des non-lues.

---

### 5.16 Tables Admin (back-office)

**`public.admin_roles`** : `(id UUID PK, code TEXT, name TEXT)` — codes : 'admin', 'super_admin'

**`public.user_roles`** : `(user_id UUID FK, admin_role_id UUID FK)` — liaison users ↔ rôles admin

**`public.admin_preferences`** : `(user_id UUID, theme TEXT, language TEXT)` — préférences theme admin

**`public.admin_logs`** : Journal des actions admin :
| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `action` | TEXT NOT NULL | Action effectuée |
| `admin_id` | UUID FK→auth.users | Admin qui a agi |
| `target_user_id` | UUID FK→auth.users | Utilisateur cible |
| `details` | JSONB | Détails de l'action |
| `created_at` | TIMESTAMPTZ | |

> **RLS** : accès uniquement via service role key (server actions) — aucun accès client direct

**`public.communication_logs`** : Logs des envois d'emails de masse :
`(id, admin_id, segment, subject, recipients_count, sent_at, mode, status)`

---

### 5.17 RPC et Fonctions SQL importantes

| Fonction | Description |
|---|---|
| `expire_trials()` | Bascule les essais expirés vers le plan `target_plan` ; sync `user_accounts.plan` |
| `generate_fac_numero()` | Génère le numéro séquentiel facture "F-YYYY-NNN" |
| `generate_rc_numero()` | Génère le numéro séquentiel contrat récurrent "RC-YYYY-MM-NNNN" |
| `check_siret_exists(TEXT)` | RPC SECURITY DEFINER — vérifie si un autre user a déjà ce SIRET (contourne RLS) |
| `handle_new_user_account()` | Trigger AFTER INSERT auth.users — crée user_accounts |
| `handle_new_user_wallet()` | Trigger AFTER INSERT auth.users — crée wallets + subscriptions |
| `ensure_user_bootstrap()` | Trigger AFTER UPDATE auth.users (last_sign_in_at) — idempotent à chaque login |
| `anonymize_deleted_accounts()` | Cron quotidien — anonymise les comptes supprimés depuis >30 jours |

---

## 6. Authentification & flux d'inscription

### 6.1 Inscription (`/register`)
1. L'utilisateur saisit son email uniquement (pas de mot de passe)
2. Cloudflare Turnstile (anti-bot)
3. Appel `POST /api/auth/check-email` (admin client, bypass RLS) :
   - Vérifie si l'email existe déjà dans `auth.users`
   - Retourne `{ shouldCreateUser: boolean, onboarding_step?: number }`
4. **3 cas** :
   - **Nouveau** → `signInWithOtp({ shouldCreateUser: true })` → magic link email
   - **Reprise onboarding** → `signInWithOtp({ shouldCreateUser: false })` → magic link email
   - **Déjà inscrit et onboarding terminé** → redirection vers `/login`
5. `/auth/callback` reçoit le code OTP → échange token → vérifie `onboarding_status`
   - Si `completed` → redirect `/`
   - Sinon → redirect `/?resume_step=N` (N = étape sauvegardée)

### 6.2 Connexion Google OAuth
- Via Supabase OAuth standard
- `ensure_user_bootstrap()` garantit la création des lignes applicatives à chaque connexion

### 6.3 Sessions
- Gestion via `@supabase/ssr` (cookies httpOnly)
- `updateSession()` rafraîchit le token dans le middleware

---

## 7. Onboarding (7 étapes)

Composant : `components/OnboardingComponent.tsx`

| Étape | Contenu |
|---|---|
| -1 (slides) | 3 slides de présentation animées (si nouvel utilisateur) |
| 1 | Informations entreprise : recherche SIREN via API gouvernementale `recherche-entreprises.api.gouv.fr`, autocomplétion adresse Google Places |
| 2 | Informations représentant légal + confirmation d'identité |
| 3 | Numéro EVTC (registre VTC) + dates assurance |
| 4 | Ajout du premier véhicule (avec autocomplete marque/modèle depuis `vehicles.csv`) |
| 5 | Ajout du premier chauffeur |
| 6 | Informations bancaires (IBAN/BIC) + acceptation CGU |
| 7 | Création mot de passe (skippé si utilisateur Google OAuth) |

**Reprise** : `goToStep(n)` sauvegarde `onboarding_step` dans `user_accounts` à chaque transition. Si le lien magic link est rouvert, `/?resume_step=N` fait passer directement à l'étape N.

**Fin d'onboarding** : `finishOnboarding()` → set `cgu_accepted_at` + `onboarding_status = 'completed'` dans `user_accounts` + `profiles` + appel `POST /api/onboarding/welcome` (emails bienvenue + démarrage essai).

**Résolution statut juridique → TVA** :
```
Micro-Entreprise → vat_mode: 'franchise', is_micro_entrepreneur: true
EI / EIRL        → vat_mode: 'franchise', is_micro_entrepreneur: false
Autres (SAS...) → vat_mode: 'normal', is_micro_entrepreneur: false
```

---

## 8. Dashboard principal (`app/page.tsx`)

SPA avec 5 onglets, routing par état React (pas de routing Next.js) :

| Onglet | Composant | Description |
|---|---|---|
| `dashboard` | `tab-dashboard.tsx` | KPIs, stats, widgets résumés |
| `calendar` | `tab-calendar.tsx` | Calendrier des courses + contrats récurrents |
| `documents` | `tab-documents.tsx` | Liste BCs + Factures, filtres, tri, actions |
| `clients` | `tab-clients.tsx` | Liste clients, fiche client, historique |
| `settings` | `tab-settings.tsx` | Profil entreprise, CGV, grille tarifaire, abonnement |

**Context central** : `NoxProvider` (`nox-context.tsx`) — chargé au montage, expose tout l'état + CRUD via Supabase. Single Supabase client stable (évite la désynchronisation de session).

**Séquence de démarrage** :
1. `app/page.tsx` vérifie la session → si absente, redirect `/login`
2. Vérifie `profiles.onboarding_status` (source de vérité) + fallback `user_accounts.onboarding_status`
3. Si non complété → affiche `OnboardingComponent`
4. Si complété + première visite de la session → affiche `WelcomeComponent` (confettis)
5. Sinon → affiche le dashboard

---

## 9. Système de bons de commande (BCs)

### Création (`create-bc.tsx`)
- Formulaire avec Google Places Autocomplete (départ + arrivée en mode "full" : rue + ville + pays)
- Calcul automatique distance + durée via Google Directions API
- Sélection client payeur + passager (peut être différent via combobox searchable)
- Sélection chauffeur et véhicule depuis la flotte
- Grille tarifaire (base + suppléments + remise)
- Multi-TVA (10%, 20%, 5,5%)
- Mode horaire : départ souhaité / arrivée souhaitée (`mode_horaire`)
- CGV : aperçu 300 chars + modale + checkbox "Inclure dans le PDF"
- Validation légale via `validateDocumentCompliance()` avant génération PDF
- Anti-doublon : `isSubmitting` + bouton grisé après génération
- Auto-save brouillon toutes les 30 secondes (`saveDraftBC`)

### PDF généré (`lib/pdf-generator.ts`)
- En-tête bicolonne : entreprise (gauche) / client+chauffeur (droite), séparateur x=105
- Carte Google Maps statique intégrée (5s timeout)
- Mention légale : "JUSTIFICATION DE LA RESERVATION PREALABLE - Article R3120-2 - Arrêté du 6 août 2025"
- TVA calculée via `isVatApplicable()` + mention franchise via `getVatMention()` (art. 293 B CGI)
- Carte VTC et véhicule masqués si champs vides
- Distance + durée sur une seule ligne
- Heure de création supprimée du PDF
- Factur-X : XML CII embarqué via `pdf-lib` (norme électronique européenne)

### Duplication, statuts, actions
- Bouton "Dupliquer" dans le menu 3 points
- Badges statuts : brouillon (gris), en_attente, confirme (or), en_cours, termine (vert), annule_client/chauffeur (rouge)
- Changement de statut via `updateBC(id, { status })`

---

## 10. Système de factures

### Création
- Depuis zéro (`create-invoice.tsx`) ou depuis un BC (`lib/convert-bc-to-invoice.ts`)
- Numérotation séquentielle via `generate_fac_numero()` PostgreSQL
- Items dynamiques (lignes de facturation)
- Statuts : brouillon → envoyée → payée
- Multi-TVA + remise
- Factur-X compatible (XML CII dans le PDF)

### Conformité Factur-X
- `lib/facturx-xml.ts` : génération XML (Cross Industry Invoice, EN 16931)
- `lib/facturx-builder.ts` : chargement du PDF visuel + embedding du XML via `pdf-lib`
- `lib/facturx-embed.ts` : helpers d'embedding

---

## 11. Back-office Admin (`/admin/*`)

### URLs
- `/admin/login` — page de login standalone (hors layout sidebar)
- `/admin/dashboard` — KPIs temps réel
- `/admin/users` — liste + fiche utilisateur détaillée
- `/admin/subscriptions` — gestion abonnements
- `/admin/support` — tickets support + réponses
- `/admin/tokens` — gestion des transactions de jetons
- `/admin/communications` — envoi d'emails de masse par segment
- `/admin/settings` — réglages admin

### Sécurité
- Middleware `proxy.ts` : vérifie session Supabase + rôle dans `user_roles` + `admin_roles`
- Service role key utilisée côté serveur pour bypass RLS
- Thème dark/light isolé via `[data-admin-theme]` CSS (n'interfère pas avec le thème utilisateur)

### KPIs dashboard admin (`/api/admin/kpis`)
Exposés via route API protégée, auto-refresh client-side.

---

## 12. Routes API (`/app/api/`)

| Route | Méthode | Description |
|---|---|---|
| `/api/auth/check-email` | POST | Vérifie existence email (admin client, bypass RLS) |
| `/api/auth/webhook` | POST | Webhook Supabase Auth |
| `/api/clients/create` | POST | Création client avec validation Zod |
| `/api/enterprise/upload-logo` | POST | Upload logo vers Supabase Storage |
| `/api/onboarding/welcome` | POST | Envoi emails bienvenue + trial-start (idempotent via `welcome_emails_sent_at`) |
| `/api/onboarding/welcome/status` | GET | Vérifie si emails déjà envoyés |
| `/api/stripe/checkout` | POST | Création session Stripe Checkout |
| `/api/stripe/webhook` | POST | Webhook Stripe → crédit tokens + mise à jour plan |
| `/api/paypal/create-order` | POST | Création order PayPal |
| `/api/paypal/capture-order` | POST | Capture paiement PayPal |
| `/api/subscription/cancel` | POST | Annulation abonnement |
| `/api/trips/confirm` | POST | Confirme une course récurrente (completed/missed) |
| `/api/trip-request/notify-operator` | POST | Notifie l'opérateur qu'un passager a rempli le formulaire |
| `/api/trip-request/confirm-passenger` | POST | Confirme côté passager |
| `/api/admin/kpis` | GET | KPIs tableau de bord admin |
| `/api/admin/send-tokens-email` | POST | Envoi email de jetons (admin) |
| `/api/actions/account.actions.ts` | — | Server Actions compte utilisateur |
| `/api/actions/support.actions.ts` | — | Server Actions tickets support |
| `/api/cron/expire-trials` | POST | Basculement essais expirés (appelé par pg_cron + Vercel Cron) |
| `/api/cron/reminders` | POST | Emails de relance (inactifs 15/30/45j, jetons faibles/épuisés) |
| `/api/cron/recurring-trips` | POST | Génération courses récurrentes |
| `/api/cron/trip-reminders` | POST | Rappels de course à J-1 |
| `/api/cron/trip-confirmations` | POST | Demandes de confirmation de course |
| `/api/cron/trial-ending` | POST | Email "essai se termine dans 2 jours" (idempotent) |
| `/api/cron/cleanup-trip-requests` | POST | Nettoyage trip_requests expirées |

> Toutes les routes `/api/cron/*` vérifient le header `x-cron-secret` contre `CRON_SECRET` env.

---

## 13. Système de jetons (tokens)

- **Génération d'un document** : coûte 1 jeton (BC ou Facture)
- **Packs disponibles** (via Stripe ou PayPal) :
  - Découverte : 10 jetons — 2€ (0,20€/jeton)
  - Privilège : 30 jetons — 4€ (0,13€/jeton)
  - Prestige : 50 jetons — 5€ (0,10€/jeton)
- **Idempotence** : le webhook Stripe vérifie `token_transactions.stripe_payment_intent_id` avant de créditer
- **Plans mensuels** : Pro (4,99€/mois, 2 chauffeurs) et Premium (9,99€/mois, 10 chauffeurs)
- **Essai gratuit** : 14 jours en plan Premium (TEAM) dès l'inscription
- **Retombée après essai** : automatique vers `target_plan` (défaut 'solo') via `expire_trials()` à 02:00 UTC

---

## 14. Emails transactionnels (Resend)

| Template | Déclencheur |
|---|---|
| `welcome.tsx` | Fin d'onboarding (email 1 immédiat) |
| `trial-start.tsx` | Fin d'onboarding (email 2, différé de 3 min) |
| `trial-ending.tsx` | Cron J-2 avant fin d'essai (idempotent) |
| `subscription-cancelled.tsx` | Webhook Stripe `customer.subscription.deleted` |
| `tokens-credited.tsx` | Après achat de jetons |

**Idempotence** : `welcome_emails_sent_at` dans `user_accounts` + `trial_ending_email_sent_at` dans `subscriptions`.

---

## 15. Conformité légale

### CGV
- 3 modes : configurateur structuré (`CGVConfig`) / texte libre / importé
- Persistées dans `profiles.cgv_mode` + `profiles.cgv_config` + `profiles.cgv_text`
- Incluses ou non dans chaque BC via `bcs.cgv_inclure`
- Aperçu 300 chars + modale dans le formulaire BC

### TVA & Micro-entrepreneur
```typescript
// Helpers dans data.ts
getVatMention(enterprise)       // Retourne la mention "TVA non applicable, art. 293 B du CGI" ou null
isVatApplicable(enterprise)     // true si assujetti à TVA
getTaxConfig(enterprise)        // Config TVA complète
getLegalSellerIdentity(enterprise) // Identité légale pour Factur-X
```

### Grille tarifaire
- Tarif de base (prise en charge, prix/km, attente/min, minimum)
- Suppléments activables (bagage, animal, siège bébé, pancarte...)
- Tranches horaires (A journée x1.00, B nuit x1.25, C week-end x1.50)
- Forfaits fixes (ex: CDG → Paris 85€)
- Grilles tarifaires multiples (par client ou contexte)

---

## 16. Google Places & Maps

- Composant `components/ui/places-autocomplete.tsx`
- Prop `addressMode?: "full" | "street"` (défaut `"street"`)
  - `"street"` : retourne rue seule (profil entreprise, fiches client/chauffeur)
  - `"full"` : retourne rue + ville + pays (champs départ/arrivée dans `create-bc.tsx` uniquement)
- Directions API : calcul automatique distance + durée dès que départ ET arrivée renseignés
- Maps Static API : carte intégrée dans le PDF du BC
- Loader Google Maps initialisé en singleton (évite les doubles initialisations)

---

## 17. Plans et limites

```typescript
export const PLAN_LIMITS: Record<Plan, { drivers: number; vehicles: number }> = {
  SOLO: { drivers: 1, vehicles: 1 },
  DUO:  { drivers: 2, vehicles: 2 },
  TEAM: { drivers: 10, vehicles: 10 },
}
```

Noms commerciaux : SOLO = "Starter", DUO = "Pro", TEAM = "Premium"

---

## 18. Sécurité

- **CSP** : nonce par requête généré dans `proxy.ts`, injecté dans les scripts via `x-nonce` header
- **RLS** : 12+ politiques RLS versionnées dans `supabase/migrations/`
- **Zod** : validation sur `POST /api/clients/create` (seule route validée explicitement)
- **TypeScript strict** : 0 erreur de build
- **SIRET unique** : index UNIQUE partiel + RPC `check_siret_exists` SECURITY DEFINER (contourne RLS cross-user)
- **Service role key** : utilisée uniquement côté serveur (webhooks, admin routes, triggers)
- **Secrets** : jamais commités, dans `.env.local` uniquement

---

## 19. Schéma récapitulatif des flux de données

```
auth.users (Supabase Auth)
    │
    ├─► user_accounts (plan, tokens, onboarding)    [trigger INSERT + trigger UPDATE login]
    ├─► profiles (entreprise, CGV, EVTC...)         [trigger INSERT]
    ├─► wallets (balance jetons)                    [trigger INSERT]
    └─► subscriptions (plan, status, trial)         [trigger INSERT]

User app flow:
/register ──► magic link ──► /auth/callback ──► /? ──► OnboardingComponent ──► Dashboard

Dashboard state (NoxProvider):
    ├── enterprise (←── profiles)
    ├── drivers   (←── public.drivers)
    ├── vehicles  (←── public.vehicles)
    ├── clients   (←── public.clients)
    ├── bcs       (←── public.bcs)
    └── invoices  (←── public.invoices)

Payment flow:
User ──► Stripe Checkout ──► /api/stripe/webhook ──► wallets.balance++
                                                   ──► token_transactions (idempotence)
                                                   ──► user_accounts.plan (abonnement)

Document generation:
create-bc.tsx ──► pdf-generator.ts ──► jsPDF (visuel) ──► facturx-builder.ts ──► pdf-lib (XML embed)
```

---

## 20. Migrations SQL — état d'application

### ✅ Toutes appliquées en production
Toutes les migrations dans `/supabase/migrations/` sont supposées appliquées, y compris :
- `20260617000001` : `onboarding_step` dans `user_accounts`
- `20260620000001` : `motorisation`, `co2`, `cylindree` dans `vehicles`
- `20260620000002` : `legal_rep_confirmed_at` dans `profiles`
- `20260620000003` : index SIRET unique + RPC `check_siret_exists`
- `20260622000001` : `welcome_emails_sent_at` dans `user_accounts`
- `20260622000002` : `trial_ending_email_sent_at` dans `subscriptions`
- `20260624000001` : `cgu_accepted_at` dans `user_accounts`
- `20260625000001` : colonne `target_plan` + fonction `expire_trials()` + pg_cron
- `20260625000002` : triggers RAISE WARNING + contrainte UNIQUE `subscriptions.user_id`
- `20260625000003` : trigger `ensure_user_bootstrap` (idempotent à chaque login)
- `20260625000004` : CHECK constraint plan insensible à la casse (lower(plan) IN 'solo','duo','team')

### ⚠️ COLONNES CODÉES MAIS MIGRATION NON CONFIRMÉE
- `profiles.is_micro_entrepreneur BOOLEAN DEFAULT false` — référencé dans `nox-context.tsx` mais la migration `20260513000001_add_micro_entrepreneur_to_profiles.sql` mentionnée dans les notes n'est **pas présente dans le dossier migrations**. La valeur est actuellement déduite de `statut_juridique` à la volée.

---

## 21. Ce qui n'est PAS encore implémenté

- **Tests automatisés** : aucun test unitaire ni e2e
- **Monitoring Sentry** : installé (package + config files) mais non configuré/actif
- **Portail client** : espace dédié pour les clients du chauffeur (voir leurs factures...)
- **Application chauffeur** : dashboard dédié chauffeur pour voir ses courses
- **Module facturation récurrente** : génération automatique des factures depuis `recurring_contracts` (partiel — les courses sont générées mais la facturation agrégée mensuelle n'est pas complète)
- **Mode hors-ligne** : l'app requiert une connexion (pas de PWA/service worker)
- **Notifications push** : la table `notifications` existe mais pas de push web
- **Signature électronique** : les champs `customerAcceptedAt`, `cgvVersionAccepted`, `signatairesNom` sont dans le type TypeScript mais pas nécessairement persistés en base

---

## 22. Principes d'implémentation retenus

1. **Supabase RLS comme couche de sécurité principale** — chaque table a ses politiques, les données sont isolées par `user_id`
2. **Context React unique** (`NoxProvider`) — tout l'état applicatif passe par là, CRUD centralisé, une seule instance Supabase client
3. **Pas de localStorage** pour les données métier — tout est en Supabase depuis le Lot 2 (sauf CGV qui était en localStorage, migré en Lot 3A)
4. **Migration progressive** — les migrations sont versionnées et idempotentes, exécutées manuellement dans Supabase Studio (pas `supabase db push` en prod car pg_cron bloque)
5. **Pas de suppression physique des BCs** — annulation par statut uniquement (audit trail)
6. **Idempotence des webhooks** — `stripe_payment_intent_id` comme clé d'unicité dans `token_transactions`
7. **EVTC jamais stocké dans les BCs** — toujours lu depuis `profiles.registre_vtc` au moment de la génération PDF
8. **Conformité légale centralisée** dans `data.ts` (helpers `getVatMention`, `isVatApplicable`, etc.)
9. **PDF Factur-X** : deux phases — `jsPDF` pour le visuel, `pdf-lib` pour l'embedding XML (les deux libs ne peuvent pas coexister dans le même flux)
10. **Triggers DB robustes** — EXCEPTION WHEN OTHERS → RAISE WARNING (jamais silencieux, jamais bloquants)
11. **Plans case-insensitive** en base depuis 20260625 (CHECK `lower(plan)`) — le code normalise en minuscules avant écriture

---

*Document généré automatiquement depuis l'analyse du code source — /home/nox/projet_nox/nox/*

---

## Implémentation du 2026-06-29 — Génération automatique de factures SaaS

**Répertoire :** `/home/nox/projet_nox/nox`  
**Intervenant :** Claude Sonnet 4.6

### Fichiers créés

#### `lib/saas-invoice-generator.ts`

Générateur central. Exporte une seule fonction publique :

```ts
generateAndStoreSaasInvoice(params: SaasInvoiceParams): Promise<string>
```

Flux interne :
1. RPC PostgreSQL `generate_saas_invoice_numero()` → format `NOX-YYYY-MM-XXXXXXX`
2. Calcul HT = montantTTC / 1.20 (arrondi 2 décimales), TVA = montantTTC − HT
3. Génération PDF via jsPDF (`output('arraybuffer')`) — style cohérent avec `lib/pdf-generator.ts` : gold `#D4AF37`, dark `#1A1A1A`, gray `#71717A`, police Helvetica
4. Création du bucket Supabase Storage `saas-invoices` (privé) si absent — erreur ignorée si déjà existant
5. Upload `saas-invoices/{userId}/{numero}.pdf`
6. Upsert dans `saas_invoices` avec `ignoreDuplicates: true` sur l'index unique `(payment_provider, provider_reference)` — idempotence totale
7. En cas de conflit : fetch + retour du numéro existant
8. Retourne le numéro de facture

Émetteur dans le PDF : ALLO VTC 77 LA FERTE SOUS JOUARRE — SIREN 930159389 — TVA FR27930159389 — TVA 20% (art. 278 du CGI)

---

#### `emails/saas-invoice.tsx`

Template Resend sobre. Exporte :

```ts
saasInvoiceEmail(props): { subject: string; html: string }
```

Props : `userName`, `numero`, `description`, `montantTTC`, `montantHT`, `tvaAmount`, `pdfUrl`, `type`

Contenu : logo N NoX VTC, salutation, encart récapitulatif (HT / TVA 20% / TTC en gold), bouton "Télécharger ma facture →" (URL signée 1 an), mentions légales.  
Sujet : `Votre facture NoX VTC — NOX-YYYY-MM-XXXXXXX`

---

### Fichiers modifiés

#### `app/api/stripe/webhook/route.ts`

Ajouts :
- 3 imports (`generateAndStoreSaasInvoice`, `saasInvoiceEmail`, `sendEmail`)
- `buildInvoiceDescription(priceId, mode)` : mappe priceId → libellé humain, couvre les deux conventions d'env (`PACK_5/15/25` et `DECOUVERTE/PRIVILEGE/PRESTIGE`)
- `handleSaasInvoiceStripe(opts)` : entièrement isolé dans un try/catch, loggue chaque étape `[saas-invoice]`

Branchement dans `checkout.session.completed` :
- `mode = payment` → après `creditTokens()` → `handleSaasInvoiceStripe({ providerReference: paymentIntentId })`
- `mode = subscription` → après `upsertSubscription()` → `handleSaasInvoiceStripe({ providerReference: subId })`

---

#### `app/api/paypal/capture-order/route.ts`

Ajouts :
- `getPlan` ajouté à l'import `lib/config/prices`
- 2 imports supplémentaires (`generateAndStoreSaasInvoice`, `saasInvoiceEmail`, `sendEmail`)
- `handleSaasInvoicePaypal(opts)` : même logique, montant issu de la config statique `prices.ts`, `providerReference = orderID`

Branchement dans `processCapture` :
- Après `token_transactions.insert` (pack) → `handleSaasInvoicePaypal()`
- Après `user_accounts.update` (abonnement) → `handleSaasInvoicePaypal()`

---

### Table `saas_invoices` — colonnes injectées

| Colonne | Valeur |
|---|---|
| `user_id` | UUID utilisateur |
| `numero` | RPC PostgreSQL |
| `type` | `'token_pack'` ou `'subscription'` |
| `description` | Libellé humain |
| `payment_provider` | `'stripe'` ou `'paypal'` |
| `provider_reference` | `payment_intent_id` ou `orderID` |
| `montant_ht` | TTC / 1.20, arrondi |
| `tva_rate` | 20 |
| `tva_amount` | TTC − HT, arrondi |
| `montant_ttc` | Montant payé |
| `currency` | `'EUR'` |
| `status` | `'issued'` → `'sent'` après email |
| `issued_at` | Timestamp émission |
| `pdf_url` | `{userId}/{numero}.pdf` |
| `email_sent_at` | Timestamp envoi email |

### Garanties de robustesse

| Risque | Protection |
|---|---|
| Erreur PDF / Storage / BDD | try/catch isolé — webhook retourne toujours 200 |
| Webhook Stripe rejoué | `ignoreDuplicates` sur `provider_reference` |
| PayPal rejoué | Même mécanisme sur `orderID` |
| Email introuvable | Guard `if (!userEmail) return` |
| Montant 0 (trial) | Guard `if (montantTTC <= 0) return` |
| Bucket inexistant | `createBucket()` appelé systématiquement, erreur ignorée |

### Prochaines étapes

- Vérifier que la RPC `generate_saas_invoice_numero()` est déployée en base
- `npm run build` pour valider TypeScript strict
- Déployer : `pm2 stop nox-vtc && pm2 start nox-vtc && pm2 save`
- Tester un paiement Stripe en sandbox → vérifier log `[saas-invoice] done`, PDF dans Storage, email reçu

---

## Audit account.actions.ts — Étapes 3 et 4 (2026-06-30)

### Étape 3 — Bloc de chiffrement (lignes 52–84)

```ts
// 3. Chiffrer chaque champ personnel via RPC archive_encrypt
async function encrypt(value: string | null | undefined): Promise<unknown> {
  if (!value) return null
  const { data, error } = await db.rpc('archive_encrypt', { text: value, key: encKey })
  if (error) throw new Error(`archive_encrypt failed: ${error.message}`)
  return data
}

let emailEncrypted: unknown
let fullNameEncrypted: unknown
let phoneEncrypted: unknown
let prenomEncrypted: unknown
let nomEncrypted: unknown
let telephoneEncrypted: unknown
let adresseEncrypted: unknown
let siretEncrypted: unknown
let nomEntrepriseEncrypted: unknown

try {
  emailEncrypted        = await encrypt(account?.email ?? userEmail)
  fullNameEncrypted     = await encrypt(account?.full_name)
  phoneEncrypted        = await encrypt(account?.phone)
  prenomEncrypted       = await encrypt(account?.prenom ?? profile?.prenom_representant_legal)
  nomEncrypted          = await encrypt(account?.nom ?? profile?.nom_representant_legal)
  telephoneEncrypted    = await encrypt(profile?.telephone)
  adresseEncrypted      = await encrypt(profile?.adresse)
  siretEncrypted        = await encrypt(profile?.siret)
  nomEntrepriseEncrypted = await encrypt(profile?.nom_entreprise)
  console.log('[deleteUserAccount] step 3 OK — fields encrypted')
} catch (err: unknown) {
  console.error('[deleteUserAccount] step 3 — encrypt error:', err)
  return { error: 'Erreur lors du chiffrement des données.' }
}
```

**Signature d'appel `archive_encrypt`** :

```ts
db.rpc('archive_encrypt', { text: value, key: encKey })
```

- `text` : la valeur à chiffrer (string)
- `key` : `process.env.ARCHIVE_ENCRYPTION_KEY`

---

### Étape 4 — INSERT dans `deleted_accounts_archive` (lignes 86–111)

```ts
// 4. INSERT dans deleted_accounts_archive
const legalRetentionUntil = new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString()

const { error: archiveError } = await db
  .from('deleted_accounts_archive')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .insert({
    original_user_id:        userId,
    email_encrypted:         emailEncrypted,
    full_name_encrypted:     fullNameEncrypted,
    phone_encrypted:         phoneEncrypted,
    prenom_encrypted:        prenomEncrypted,
    nom_encrypted:           nomEncrypted,
    telephone_encrypted:     telephoneEncrypted,
    adresse_encrypted:       adresseEncrypted,
    siret_encrypted:         siretEncrypted,
    nom_entreprise_encrypted: nomEntrepriseEncrypted,
    deletion_reason:         'user_request',
    legal_retention_until:   legalRetentionUntil,
  } as Record<string, unknown>)

if (archiveError) {
  console.error('[deleteUserAccount] step 4 — archive insert error:', archiveError)
  return { error: "Erreur lors de l'archivage des données." }
}
console.log('[deleteUserAccount] step 4 OK — archive created')
```

---

## Correctifs account.actions.ts — Étapes 3 et 4 (2026-06-30)

### Bug 1 corrigé — Paramètres RPC (ligne 55)

```ts
// AVANT
const { data, error } = await db.rpc('archive_encrypt', { text: value, key: encKey })

// APRÈS
const { data, error } = await db.rpc('archive_encrypt', { p_plain: value, p_key: encKey })
```

### Bug 2 corrigé — Variables intermédiaires (étape 3)

```ts
// SUPPRIMÉES : fullNameEncrypted, phoneEncrypted
// RENOMMÉES  : siretEncrypted → sirenEncrypted
//              nomEntrepriseEncrypted → raisonSocialeEncrypted

let emailEncrypted: unknown
let prenomEncrypted: unknown
let nomEncrypted: unknown
let telephoneEncrypted: unknown
let adresseEncrypted: unknown
let sirenEncrypted: unknown
let raisonSocialeEncrypted: unknown

emailEncrypted         = await encrypt(account?.email ?? userEmail)
prenomEncrypted        = await encrypt(account?.prenom ?? profile?.prenom_representant_legal)
nomEncrypted           = await encrypt(account?.nom ?? profile?.nom_representant_legal)
telephoneEncrypted     = await encrypt(account?.phone ?? profile?.telephone)
adresseEncrypted       = await encrypt(profile?.adresse)
sirenEncrypted         = await encrypt(profile?.siret)
raisonSocialeEncrypted = await encrypt(profile?.nom_entreprise)
```

### Bug 2 corrigé — INSERT deleted_accounts_archive (étape 4)

```ts
// SUPPRIMÉES : full_name_encrypted, phone_encrypted
// siret_encrypted          → siren_encrypted
// nom_entreprise_encrypted → raison_sociale_encrypted

.insert({
  original_user_id:         userId,
  email_encrypted:          emailEncrypted,
  prenom_encrypted:         prenomEncrypted,
  nom_encrypted:            nomEncrypted,
  telephone_encrypted:      telephoneEncrypted,
  adresse_encrypted:        adresseEncrypted,
  siren_encrypted:          sirenEncrypted,
  raison_sociale_encrypted: raisonSocialeEncrypted,
  deletion_reason:          'user_request',
  legal_retention_until:    legalRetentionUntil,
} as Record<string, unknown>)
```

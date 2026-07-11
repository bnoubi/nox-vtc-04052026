# Axeptio — Audit et plan des pages légales

## ÉTAPE 1 — Vérification (2026-07-09)

**Aucune page légale de type route Next.js n'existe.** Ce qui a été trouvé :

| Élément | Emplacement | Remarque |
|---|---|---|
| CGU/CGV (PDF) | `/public/assets/CGU_CGV_NoX_VTC.pdf` | Affiché via iframe dans un modal de l'onboarding (`OnboardingComponent.tsx:1479`), pas une page routée |
| `AxeptioConsent.tsx` | `components/AxeptioConsent.tsx` | Gère déjà l'event `cookies:complete` et injecte/bloque Google Analytics selon le choix utilisateur |
| Footer avec liens | Aucun | Pas de footer global dans `app/layout.tsx` ni dans les composants |

Routes existantes dans `app/` : `/login`, `/register`, `/auth/*`, `/payment/*`, `/request/[token]`, `/admin/*`. Aucune route légale.

---

## ÉTAPE 2 — Pages à créer

### `/politique-de-confidentialite` → `app/politique-de-confidentialite/page.tsx`

Contenu attendu :

- **Responsable de traitement** : NoX VTC, Bernard Noubi, bernardnoubi@gmail.com
- **Données collectées** : email, nom/prénom, téléphone, SIREN/SIRET, adresse professionnelle, données de trajet (clients, horaires), données de facturation (Stripe/PayPal)
- **Finalités & base légale** :
  - Exécution du contrat : gestion abonnement, facturation
  - Intérêt légitime : sécurité, amélioration du service
  - Consentement : analytics GA
- **Durée de conservation** :
  - Données de compte actif : durée de l'abonnement + 3 ans
  - Données de facturation : 10 ans (obligation légale)
- **Droits RGPD** : accès, rectification, suppression (via l'interface ou bernardnoubi@gmail.com), opposition, portabilité, réclamation CNIL
- **Sous-traitants** : Supabase (hébergement BDD), Stripe/PayPal (paiement), VPS Ubuntu (hébergement), Google Analytics (si consentement)

---

### `/politique-de-cookies` → `app/politique-de-cookies/page.tsx`

Contenu attendu :

**Cookies strictement nécessaires** (pas de consentement requis) :

| Nom | Fournisseur | Finalité | Durée |
|---|---|---|---|
| `sb-*` | Supabase | Session d'authentification | Session |
| `sidebar:state` | NoX VTC | Préférence UI sidebar | 1 an |

**Cookies analytiques** (consentement requis via Axeptio) :

| Nom | Fournisseur | Finalité | Durée |
|---|---|---|---|
| `_ga` | Google Analytics | Identification visiteur unique | 2 ans |
| `_gid` | Google Analytics | Distinction des sessions | 24 h |

**Cookie de consentement** :

| Nom | Fournisseur | Finalité | Durée |
|---|---|---|---|
| `axeptio_cookies` | Axeptio | Mémorisation des choix de consentement | 13 mois |
| `axeptio_authorized_vendors` | Axeptio | Liste des vendors autorisés | 13 mois |

**Gestion du consentement** : le widget Axeptio (Project ID `6a38caef6f0c0b69da2fc608`) permet de modifier ses choix à tout moment. Un lien "Gérer mes cookies" sera ajouté en bas de page.

---

## ÉTAPE 3 — URLs pour le dashboard Axeptio

À renseigner dans Axeptio > Configuration du widget de consentement, une fois les pages déployées et validées :

- **Privacy Policy** : `https://app.noxvtc.fr/politique-de-confidentialite`
- **Cookie Statement** : `https://app.noxvtc.fr/politique-de-cookies`

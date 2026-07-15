# Audit — Section Notifications NoX VTC
**Date : 2026-07-14 | Auteur : Claude Code**

---

## 1. Les toggles sont-ils réels ?

### État actuel du code (`NotificationsScreen`)

```ts
const [prefs, setPrefs] = useState({
  pushReservations: true,
  pushMessages:     true,
  pushPromotions:   false,
  emailRecap:       true,
  emailFactures:    true,
  smsConfirmation:  true,
  smsRappel:        false,
})
```

**Source** : `useState` local initialisé avec des valeurs en dur dans le composant.  
Aucun `useEffect` ne charge des préférences depuis la base.  
Aucun appel API/action serveur ne persiste les changements.

### Table de préférences utilisateur

**N'existe pas.** La migration `20260604000002_notifications.sql` crée une table
`notifications` pour stocker des messages individuels (type, titre, message, read),
**pas** des préférences par canal ou catégorie. Il n'existe aucune table
`notification_preferences` dans les 54 migrations versionnées.

### Persistance au rechargement

**Aucune.** Toute modification d'un toggle est perdue dès que la page se recharge
ou que l'utilisateur navigue et revient sur l'écran Notifications.

### Les emails existants consultent-ils ces toggles ?

**Non, jamais.** Les 16 templates Resend et tous les appels `sendEmail` dans l'app
partent inconditionnellement, sans aucune vérification de préférence utilisateur :

| Déclencheur | Fichier | Vérification prefs ? |
|---|---|---|
| Email de bienvenue | `api/onboarding/welcome/route.ts` | ✗ |
| Essai démarré | `api/onboarding/welcome/route.ts` | ✗ |
| Essai se terminant | `api/cron/trial-ending/route.ts` | ✗ |
| Abonnement expiré | `api/cron/expire-trials/route.ts` | ✗ |
| Plan changé | `api/stripe/webhook/route.ts` | ✗ |
| Abonnement annulé | `api/subscription/cancel/route.ts` | ✗ |
| Facture SaaS | `api/stripe/webhook/route.ts` | ✗ |
| Paiement PayPal | `api/paypal/capture-order/route.ts` | ✗ |
| Jetons offerts | `api/admin/send-tokens-email/route.ts` | ✗ |
| Mot de passe changé | `app/actions/security.ts` | ✗ |
| Code 2FA | `app/actions/two-factor.ts` | ✗ |
| OTP suppression compte | `api/account/request-deletion-otp/route.ts` | ✗ |
| Compte suppression programmée | `app/admin/actions.ts` | ✗ |
| Invitation admin | `app/admin/(protected)/team/actions.ts` | ✗ |
| Rôle admin changé | `app/admin/(protected)/team/actions.ts` | ✗ |
| Réponse ticket support | `app/admin/(protected)/support/[id]/actions.ts` | ✗ |
| Inactifs 15/30/45j + jetons faibles | `api/cron/reminders/route.ts` | ✗ |

### Conclusion

**Tous les toggles sont des FAÇADES.** 7 toggles, 0 persisté, 0 consulté.
L'utilisateur peut tout désactiver : il continuera à recevoir tous les emails
exactement comme avant. C'est une tromperie UX involontaire qu'il faut documenter
clairement en interne et corriger avant le lancement.

**Exception partielle** : la table `notifications` (en base) est réellement utilisée
pour 2 types d'événements push in-app — `trip_reminder` et `trip_confirmation`
(insérés par les crons, lus par `header.tsx`). Ces deux notifications push in-app
fonctionnent indépendamment des toggles.

---

## 2. Inventaire exhaustif des événements notifiables

### A. Documents & Conformité

Champs d'expiration présents en base :

| Champ | Table | Notification actuelle |
|---|---|---|
| `carte_pro_expiration` (DATE) | `drivers` | **Aucune** |
| `apac_expiration` (DATE) | `drivers` | **Aucune** |
| `rc_pro_expiration` (DATE) | `drivers` | **Aucune** |
| `permisExpiration` (interface Driver, champ base à confirmer) | `drivers` | **Aucune** |
| `assurance_transport_expiration` (DATE) | `vehicles` | **Aucune** |
| `controle_technique_expiration` (DATE) | `vehicles` | **Aucune** |
| `date_registre_vtc` (DATE) | `profiles` | **Aucune** |
| `date_assurance_pro` (DATE) | `profiles` | **Aucune** |

Tous ces champs sont saisis manuellement à l'onboarding ou dans les fiches
chauffeur/véhicule. Aucun cron ne surveille ces dates pour alerter.
Le composant `ComplianceDot` (`compliance-dot.tsx`) calcule localement un statut
visuel (rouge/orange/vert) basé sur la proximité d'expiration, mais n'émet aucune
notification.

### B. Courses & Réservations

| Événement | Notification actuelle | Canal | Fréquence |
|---|---|---|---|
| Rappel 30 min avant course récurrente | **Email + push in-app** | Email Resend + table `notifications` | Cron toutes les 30 min |
| Confirmation de course passée | **Push in-app** | Table `notifications` (type `trip_confirmation`) | Cron toutes les heures |
| Nouvelle demande de trajet (trip_request) | **Email** vers opérateur | Email plain HTML | À chaque soumission passager |
| Confirmation passager trip_request | **Email** vers passager | Email plain HTML | À chaque confirmation |
| Cours récurrente générée | **Email** vers utilisateur | Email plain HTML | Cron quotidien à 5h UTC |

**Réservations récurrentes** : le mécanisme existe via les tables `recurring_contracts`
et `recurring_trips` (migrations 2026-06-02 à 2026-06-04). Les contrats définissent
des trajets récurrents que le cron génère chaque matin.

**Rappel de course** : actuellement uniquement pour les trajets récurrents, pas pour
les bons de commande (BCs) manuels.

### C. Facturation & Paiements

| Événement | Notification actuelle | Canal |
|---|---|---|
| Facture SaaS générée (Stripe) | **Email** template `saas-invoice` | Email Resend |
| Paiement jetons capturé (PayPal) | **Email** plain HTML | Email Resend |
| Paiement Stripe échoué | **Aucune** | — |
| Facture client (BC converti en facture) | **Aucune** | — |

Les factures clients générées dans l'app (module Facturation/BCs) n'envoient
aucun email de confirmation à l'utilisateur.

### D. Abonnement & Jetons

| Événement | Notification actuelle | Canal | Fréquence |
|---|---|---|---|
| Essai démarré | Email `trial-start` (scheduledAt J+0) | Email Resend | Une fois |
| Essai se terminant (J-3 avant fin) | Email `trial-ending` | Email Resend | Cron quotidien |
| Essai expiré | Email `subscription-expired` | Email Resend | Cron `expire-trials` |
| Plan changé | Email `plan-changed` | Email Resend | Webhook Stripe |
| Abonnement annulé | Email `subscription-cancelled` | Email Resend | Sur action |
| Jetons offerts | Email `tokens-gifted` | Email Resend | Sur action admin |
| Jetons épuisés (balance = 0) | Email plain HTML | Email Resend | Cron hebdo max |
| Jetons faibles (balance < 3) | Email plain HTML | Email Resend | Cron hebdo max |
| Abonnement expiré | Email plain HTML | Email Resend | Cron hebdo max |

**Tous inconditionnels** — aucun ne consulte de préférence utilisateur.

### E. Sécurité & Compte

| Événement | Notification actuelle | Canal |
|---|---|---|
| Code 2FA envoyé | Email `2fa-code` | Email Resend |
| Mot de passe changé | Email `password-changed` | Email Resend |
| OTP suppression compte | Email `account-deletion-otp` | Email Resend |
| Suppression programmée | Email `account-deletion-scheduled` | Email Resend |
| Nouvelle connexion depuis un appareil inconnu | **Aucune** | — |

### F. Support

| Événement | Notification actuelle | Canal |
|---|---|---|
| Ticket soumis par l'utilisateur | Aucune email vers l'utilisateur | — |
| Réponse admin au ticket | **Email** plain HTML | Email Resend |
| Ticket résolu | **Aucune** | — |

### G. Score NoX & Onboarding

| Événement | Notification actuelle |
|---|---|
| Score NoX faible / éléments critiques manquants | **Aucune** — calculé localement dans `nox-context.tsx` |
| Onboarding incomplet (utilisateur bloqué) | **Aucune** |
| Inactif 15 jours | Email plain HTML (cron `nightly-reminders`, hebdo max) |
| Inactif 30 jours | Email plain HTML |
| Inactif 45 jours | Email plain HTML avec code promo RETOUR30 (⚠️ hardcodé) |

### H. Administration (hors scope utilisateur final)

| Événement | Notification actuelle |
|---|---|
| Invitation admin | Email `admin-invitation` |
| Rôle admin changé | Email `admin-role-changed` |
| Email groupé (communications admin) | Email plain HTML |

---

## 3. Proposition de regroupement

Réorganiser par **domaine métier** plutôt que par canal technique.
Avantage : l'utilisateur comprend QUE va-t-il recevoir et POURQUOI,
pas comment ça arrive.

### Structure proposée

---

#### 🗂 Documents & Conformité
*Canal recommandé : Push in-app (urgence) + Email (avant échéance)*
*Fréquence : Programmé à J-90, J-30, J-7, J-1 avant expiration + immédiat si dépassé*

| Toggle | Par défaut | Canal |
|---|---|---|
| Alertes expiration carte VTC | ✅ ON | Push + Email |
| Alertes expiration APAC | ✅ ON | Push + Email |
| Alertes expiration RC Pro | ✅ ON | Push + Email |
| Alertes expiration contrôle technique | ✅ ON | Push + Email |
| Alertes expiration assurance transport | ✅ ON | Push + Email |

**Blocage V1** : nécessite un cron quotidien de surveillance des dates
d'expiration + une table `notification_preferences`.

---

#### 🚗 Courses & Réservations
*Canal recommandé : Push in-app (en temps réel) + Email (digest)*
*Fréquence : Immédiat pour demandes/rappels, digest pour récapitulatif*

| Toggle | Par défaut | Canal | État actuel |
|---|---|---|---|
| Rappel avant course (30 min) | ✅ ON | Push in-app | **Fonctionnel** (cron) |
| Confirmation de course | ✅ ON | Push in-app | **Fonctionnel** (cron) |
| Nouvelle demande de trajet | ✅ ON | Email | **Fonctionnel** (webhook) |
| Résumé quotidien des courses | ⬜ OFF | Email | ❌ Façade |

---

#### 💳 Facturation & Paiements
*Canal recommandé : Email (traçabilité) + Push in-app*
*Fréquence : Immédiat*

| Toggle | Par défaut | Canal | État actuel |
|---|---|---|---|
| Facture SaaS générée | ✅ ON | Email | **Fonctionnel** (Stripe) |
| Paiement jetons confirmé | ✅ ON | Email | **Fonctionnel** (PayPal) |
| Échec de paiement | ✅ ON | Email + Push | ❌ Non implémenté |
| Facture client envoyée | ⬜ OFF | Email | ❌ Non implémenté |

---

#### 📦 Abonnement & Jetons
*Canal recommandé : Email uniquement (décisions business)*
*Fréquence : Immédiat ou programmé*

| Toggle | Par défaut | Canal | État actuel |
|---|---|---|---|
| Essai se terminant | ✅ ON | Email | **Fonctionnel** — non opt-out |
| Plan changé | ✅ ON | Email | **Fonctionnel** — non opt-out |
| Jetons faibles (< 3) | ✅ ON | Email | **Fonctionnel** — non opt-out |
| Jetons épuisés | ✅ ON | Email | **Fonctionnel** — non opt-out |

**Note** : ces 4 catégories sont des notifications transactionnelles critiques.
Le RGPD permet de les maintenir sans opt-out explicite si elles sont nécessaires
à l'exécution du contrat. Les inclure dans les toggles est une bonne pratique
UX mais elles ne devraient jamais être vraiment désactivées sans validation légale.

---

#### 🔒 Sécurité & Compte
*Canal recommandé : Email toujours (obligatoire) + Push pour les critiques*
*Fréquence : Immédiat*

| Toggle | Par défaut | Canal | Opt-out possible ? |
|---|---|---|---|
| Code 2FA | ✅ ON | Email | ❌ Non |
| Mot de passe modifié | ✅ ON | Email | ❌ Non |
| Nouvelle connexion | ✅ ON | Email + Push | Débattable |
| Suppression de compte | ✅ ON | Email | ❌ Non |

**Ces 4 types ne doivent pas être opt-out** — ils sont des notifications
de sécurité obligatoires. Les afficher comme toggles serait trompeur.
Préférer une section informative ("Ces alertes ne peuvent pas être désactivées").

---

#### 🎧 Support
*Canal recommandé : Email + Push in-app*
*Fréquence : Immédiat*

| Toggle | Par défaut | Canal | État actuel |
|---|---|---|---|
| Réponse à votre ticket | ✅ ON | Email | **Fonctionnel** |
| Ticket résolu | ✅ ON | Email + Push | ❌ Non implémenté |

---

#### 📣 Marketing & Actualités
*Canal recommandé : Email uniquement — opt-in explicite*
*Fréquence : Hebdo max*

| Toggle | Par défaut | Canal |
|---|---|---|
| Offres et promotions NoX | ⬜ OFF (opt-in) | Email |
| Actualités et nouveautés | ⬜ OFF (opt-in) | Email |
| Rappels d'inactivité | ⬜ OFF (opt-in) | Email |

**⚠️ RGPD** : les emails marketing (promotions, code RETOUR30, inactivité)
nécessitent un consentement explicite (opt-in). L'opt-out seul ne suffit pas.
Le cron `reminders` envoie actuellement ces emails sans vérification de consentement.

---

## 4. Bug — Toggles instables (cascade visuelle)

### Diagnostic

**Cause racine identifiée** : `Toggle` et `NotifRow` étaient définis comme fonctions
**à l'intérieur** de `NotificationsScreen` :

```tsx
function NotificationsScreen({ onBack }) {
  const [prefs, setPrefs] = useState({...})

  function Toggle(...) { ... }   // ← nouvelle référence à chaque render
  function NotifRow(...) { ... } // ← nouvelle référence à chaque render
}
```

Comportement :
1. L'utilisateur clique sur un toggle → `setPrefs` déclenche un re-render
2. React voit `Toggle` et `NotifRow` comme de **nouveaux types de composants**
   (nouvelles références de fonction) à chaque render
3. React **démonte** toutes les instances existantes et **remonte** de nouvelles
4. Les `motion.div` de Framer Motion sont remontés depuis leur état initial CSS
   (`left: auto` → interprété comme 0 par Framer Motion)
5. Chaque `motion.div` anime de 0 → position cible, visible par l'utilisateur
   comme un "saut" de tous les toggles simultanément

### Fix appliqué

`NotifToggle` et `NotifRow` sont extraits **au niveau du module** (hors
`NotificationsScreen`). Ils ont maintenant des références stables entre renders.
`NotifRow` reçoit `checked` et `onChange` directement en props au lieu d'accéder
au closure `prefs`/`setPrefs` du parent.

```tsx
// Module level — référence stable, pas de remount
function NotifToggle({ checked, onChange }) { ... }
function NotifRow({ label, description, checked, onChange }) { ... }

function NotificationsScreen({ onBack }) {
  const [prefs, setPrefs] = useState<NotifPrefs>({...})
  function toggle(field: keyof NotifPrefs) {
    setPrefs(prev => ({ ...prev, [field]: !prev[field] }))
  }
  // NotifRow reçoit checked={prefs.pushReservations} onChange={() => toggle("pushReservations")}
}
```

**Résultat** : seul le toggle cliqué re-rend et anime. Ses voisins ne bougent pas.

---

## 5. Conseils & Conformité VTC

### Principe

Relier chaque date d'expiration de document à sa **conséquence légale réelle**,
avec les références exactes du Code des transports.

### Base légale

**Articles L3120-1 à L3124-12 du Code des transports** (Legifrance)

Éléments pertinents pour les VTC :

- **L3120-1** : définit les véhicules de transport avec chauffeur (VTC)
- **L3120-2** : conditions pour exercer l'activité de VTC (capacité professionnelle,
  immatriculation au registre, conditions du véhicule)
- **L3122-1 à L3122-3** : obligation d'inscription au registre des VTC (géré par
  l'Autorité de régulation des transports - ART)
- **L3124-1 à L3124-12** : **infractions et sanctions**
  - L3124-1 : exercice illégal de transport routier de personnes (conduite sans
    autorisation) — infraction de 5e classe
  - L3124-2 à L3124-5 : sanctions pour les personnes morales
  - L3124-11 : immobilisation du véhicule possible en cas d'infraction constatée

*⚠️ Les montants exacts des amendes ne sont pas reproduits ici : ils sont fixés
par décret et peuvent évoluer. Se référer exclusivement à Legifrance pour les
montants à jour.*

### Catégorie proposée : "Alertes Conformité VTC"

**Déclencheur** : cron quotidien comparant `now()` aux dates d'expiration
stockées en base (`drivers.carte_pro_expiration`, `vehicles.controle_technique_expiration`, etc.)

**Paliers d'alerte** : J-90, J-30, J-7, J-1, J+0 (expiration), J+1 (dépassement)

---

#### Modèles de notification proposés

**Carte professionnelle VTC — J-30**

> **🟡 Votre carte professionnelle VTC expire dans 30 jours**
>
> La carte professionnelle de [Nom du chauffeur] expire le [date].
>
> Le renouvellement est à demander auprès de l'Autorité de régulation des transports (ART).
> Exercer l'activité de VTC avec une carte expirée constitue une infraction
> susceptible d'entraîner des sanctions (Code des transports, art. L3124-1).
>
> *ℹ️ Information indicative, ne remplace pas un conseil juridique.*

---

**Carte professionnelle VTC — J+1 (expirée)**

> **🔴 Carte professionnelle VTC expirée — Risque d'infraction**
>
> La carte professionnelle de [Nom du chauffeur] a expiré le [date].
>
> L'exercice de l'activité VTC sans carte professionnelle valide est interdit
> (Code des transports, art. L3120-2 et L3124-1). En cas de contrôle,
> l'immobilisation du véhicule peut être ordonnée (art. L3124-11).
>
> Suspendez l'activité de ce chauffeur jusqu'au renouvellement.
>
> *ℹ️ Information indicative, ne remplace pas un conseil juridique.*

---

**Contrôle technique — J-7**

> **🟡 Contrôle technique du véhicule [immatriculation] dans 7 jours**
>
> Le contrôle technique expire le [date].
> Un véhicule dont le contrôle technique est périmé ne peut légalement circuler.
> En cas de contrôle routier, le véhicule peut être immobilisé.
>
> *ℹ️ Information indicative, ne remplace pas un conseil juridique.*

---

**Assurance transport à titre onéreux — J-30**

> **🟡 Assurance transport expirée dans 30 jours**
>
> L'assurance Transport à Titre Onéreux du véhicule [immatriculation] expire le [date].
> Une activité VTC sans assurance valide expose à des sanctions pénales
> et à l'engagement de la responsabilité personnelle en cas d'accident.
>
> *ℹ️ Information indicative, ne remplace pas un conseil juridique.*

---

**APAC (Attestation Préfectorale) — J-90**

> **🟠 Renouvellement APAC recommandé dans 90 jours**
>
> L'attestation préfectorale de [Nom] expire le [date].
> Le délai de renouvellement auprès de la préfecture peut être long.
> Il est recommandé d'anticiper la demande.
>
> *ℹ️ Information indicative, ne remplace pas un conseil juridique.*

---

### Contraintes d'implémentation (pour référence future)

- Ces notifications doivent être **non désactivables** par défaut (conformité
  légale impacte directement l'activité)
- Afficher le statut dans l'app (badge rouge sur la fiche chauffeur/véhicule)
  EN PLUS de la notification — le `ComplianceDot` fait déjà ce travail visuellement
- Chaque message doit obligatoirement inclure la mention
  *"Information indicative, ne remplace pas un conseil juridique."*
- Ne jamais citer de montants d'amende en dur dans le code (utiliser des formules
  génériques comme "sanctions prévues par le Code des transports")

---

## Priorisation V1 / V2

### V1 — Avant lancement (bloquant ou fortement recommandé)

| # | Action | Effort | Priorité | Motif |
|---|---|---|---|---|
| 1 | **Créer table `notification_preferences`** | Faible (migration SQL) | 🔴 Critique | Les toggles sont des façades — tromperie UX |
| 2 | **Persister les prefs au changement de toggle** | Faible (server action) | 🔴 Critique | Suite logique du point 1 |
| 3 | **Supprimer ou marquer les toggles Push/SMS comme "bientôt"** | Minimal | 🟠 Urgent | Push natif et SMS non implémentés — les afficher comme actifs est trompeur |
| 4 | **Opt-in explicite pour les emails marketing** | Moyen | 🟠 Urgent | RGPD — le cron reminders envoie sans consentement |
| 5 | **Fix bug cascade toggles (Framer Motion)** | Fait ✅ | — | Corrigé dans ce commit |

### V2 — Après lancement (amélioration produit)

| # | Action | Effort | Valeur |
|---|---|---|---|
| 6 | Cron quotidien surveillance expirations documents | Moyen | 🔴 Haute — conformité légale |
| 7 | Notifications conformité VTC avec modèles définis en §5 | Moyen | 🔴 Haute — différenciateur produit |
| 8 | Restructurer la section Notifications par domaine métier (§3) | Moyen | 🟠 Moyenne |
| 9 | Rappels BCs manuels (pas seulement trajets récurrents) | Faible | 🟡 Basse |
| 10 | Notification push native (FCM/APNs) | Élevé | 🟡 Basse — app web, pas mobile native |
| 11 | SMS réels (Twilio ou équivalent) | Élevé | 🟡 Basse — coût récurrent |
| 12 | Digest quotidien courses | Moyen | 🟡 Basse |
| 13 | Notification nouvelle connexion (sécurité) | Moyen | 🟠 Moyenne |

### Faisabilité résumée

- **Points 1-4 (V1)** : 1-2 jours de développement. Point 1+2 = une migration +
  une server action + un `useEffect` dans `NotificationsScreen`. Point 4 = ajouter
  une colonne `marketing_email_consent` dans `user_accounts` + checkbox dans les CGU.
- **Point 6+7 (V2, conformité)** : 3-4 jours. Le cron est le pattern déjà utilisé
  pour `trip-reminders`. Les templates email suivent le pattern Resend existant.
  Le travail principal est la logique de paliers (J-90/J-30/J-7/J+0) et la table
  `document_expiry_alerts_sent` pour éviter les doublons.
- **Points 10-11 (push natif + SMS)** : effort élevé, ROI faible pour une PWA.
  Déprioritiser jusqu'à l'éventuelle app mobile native.

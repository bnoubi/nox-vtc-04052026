# Audit fonctionnel NoX VTC — matière brute marketing

> **Public cible** : chauffeur VTC indépendant ou petite flotte (France principalement)
> **Format** : bénéfice utilisateur · statut réel · écran de référence
> **Date** : 23 juillet 2026

---

## INSCRIPTION & PRISE EN MAIN

### 1. Inscription intelligente en 7 étapes guidées
Créez votre compte en moins de 5 minutes grâce à un assistant pas-à-pas qui pré-remplit votre profil depuis le registre officiel des entreprises. Votre SIRET est vérifié en temps réel pour détecter automatiquement votre activité VTC (codes NAF 4932Z et 4939B).
**✅ Fonctionnelle** — `/app/page.tsx` + `OnboardingComponent.tsx`

### 2. Reprise d'inscription à tout moment
Si vous quittez l'inscription en cours de route, NoX reprend exactement là où vous vous êtes arrêté dès votre prochaine connexion. Aucune donnée saisie n'est perdue.
**✅ Fonctionnelle** — Paramètre `resume_step` + `onboarding_status` en base

### 3. Connexion Google en un clic
Connectez-vous instantanément avec votre compte Google — aucun mot de passe à mémoriser, et la même sécurité que votre messagerie.
**✅ Fonctionnelle** — `AuthScreen.tsx`

### 4. Vérification en deux étapes par email (2FA)
Activez une couche de sécurité supplémentaire : à chaque connexion, un code à 6 chiffres valable 10 minutes est envoyé à votre email. Vos données restent protégées même si votre mot de passe est compromis.
**✅ Fonctionnelle** — `tab-settings.tsx` → Compte & Sécurité / `/app/verify-email-code`

---

## TABLEAU DE BORD

### 5. Vue d'ensemble de votre activité
Dès la connexion, votre tableau de bord affiche vos prochaines courses, vos indicateurs clés et votre score de conformité en temps réel. Tout ce dont vous avez besoin en un seul coup d'œil.
**✅ Fonctionnelle** — `tab-dashboard.tsx`

### 6. Prochain trajet toujours visible
Un widget dédié affiche votre prochain trajet confirmé avec heure, client et adresse de prise en charge — sans avoir à fouiller dans vos réservations.
**✅ Fonctionnelle** — `next-trip-widget.tsx`

### 7. Calendrier des courses
Visualisez toutes vos courses en vue calendrier mensuelle ou hebdomadaire pour anticiper votre planning et éviter les chevauchements.
**✅ Fonctionnelle** — `tab-calendar.tsx`

### 8. Guardian Score — votre indice de conformité
NoX calcule en permanence votre score de conformité réglementaire sur 100 : documents en règle, cartes professionnelles valides, assurances à jour, CGV configurées. Un indicateur visuel coloré vous alerte bien avant l'expiration d'un document.
**✅ Fonctionnelle** — `compliance-dot.tsx` + logique dans `tab-settings.tsx` / `tab-dashboard.tsx`

---

## GESTION DES RÉSERVATIONS (BONS DE COMMANDE)

### 9. Création de bon de commande complète
Créez un bon de commande détaillé en quelques touches : client, passager, adresse de départ, arrivée, étapes intermédiaires, date/heure, nombre de passagers et de bagages, chauffeur et véhicule assignés. Tout est consigné, rien n'est oublié.
**✅ Fonctionnelle** — `create-bc.tsx`

### 10. Lien de demande passager (sans compte requis)
Générez un lien unique à durée limitée (24-48h) que votre client remplit lui-même avec ses informations de trajet. Vous récupérez la demande complète dans votre tableau de bord sans aucun échange de message manuel.
**✅ Fonctionnelle** — `tab-documents.tsx` → onglet Demandes + `recurring-screen.tsx`

### 11. Partage de demande via SMS, WhatsApp ou email
Envoyez votre lien de prise en charge directement depuis l'application via le canal préféré de votre client — sans copier-coller ni application tierce.
**✅ Fonctionnelle** — `tab-documents.tsx`

### 12. Suivi du cycle de vie complet d'une réservation
Chaque réservation passe par un workflow en 7 états : Brouillon → En attente → Confirmé → En cours → Terminé (ou Annulé). Vous savez à tout moment où en est chaque prestation.
**✅ Fonctionnelle** — `tab-documents.tsx`

### 13. Prestation libre (facturation sans bon de commande)
Pour les courses ponctuelles ou informelles, créez directement une facture sans bon de commande préalable — idéal pour les prestations en espèces ou en dernière minute.
**✅ Fonctionnelle** — `create-invoice.tsx` mode "Libre"

### 14. Contrats récurrents avec génération automatique des courses
Paramétrez un contrat (client fixe, jours et horaires réguliers, aller-retour, jours fériés exclus) et NoX génère automatiquement chaque trajet et sa facturation, sans que vous ayez à refaire quoi que ce soit chaque semaine.
**✅ Fonctionnelle** — `recurring-screen.tsx` + cron `/api/cron/recurring-trips`

---

## FACTURATION

### 15. Génération de facture conforme en un clic
Convertissez n'importe quel bon de commande confirmé en facture PDF professionnelle d'un seul tap. Mentions légales, TVA, identité du vendeur et coordonnées bancaires sont pré-remplies automatiquement.
**✅ Fonctionnelle** — `create-invoice.tsx` + `lib/pdf-generator.ts`

### 16. Gestion multi-TVA
Configurez plusieurs taux de TVA sur une même facture (5,5 %, 10 %, 20 %, exonération micro-entrepreneur). NoX calcule automatiquement chaque ligne et le total, quel que soit votre régime fiscal.
**✅ Fonctionnelle** — `create-invoice.tsx`

### 17. Facture électronique Factur-X intégrée
Chaque PDF généré embarque un fichier XML au standard Factur-X (norme européenne UBL), conforme aux exigences de facturation électronique B2B françaises. Vos clients entreprise reçoivent une facture lisible par leur logiciel comptable.
**✅ Fonctionnelle** — `lib/facturx-*.ts`

### 18. Suppléments et remises personnalisables
Ajoutez en quelques secondes des suppléments (bagage, animal, siège bébé, mise à disposition, terminal d'aéroport, pancarte nominative) ou appliquez une remise en pourcentage ou en montant fixe. La TVA se recalcule automatiquement.
**✅ Fonctionnelle** — `create-invoice.tsx` + `create-bc.tsx`

### 19. Conditions de règlement et moyens de paiement
Choisissez les délais de paiement (immédiat, 15 jours, 30 jours) et les moyens acceptés (CB, Apple Pay, Google Pay, PayPal, virement, espèces). Ces informations apparaissent automatiquement en bas de chaque facture.
**✅ Fonctionnelle** — `create-invoice.tsx`

### 20. Suivi des statuts de factures
Chaque facture affiche son statut en temps réel : Brouillon, Envoyée, Payée. Vous savez instantanément lesquelles attendent un règlement.
**✅ Fonctionnelle** — `tab-documents.tsx`

---

## GESTION DES CHAUFFEURS

### 21. Fichier chauffeurs complet avec conformité intégrée
Enregistrez chacun de vos chauffeurs avec tous leurs documents réglementaires : carte professionnelle VTC, attestation préfectorale (APAC), RC professionnelle, permis de conduire — chacun avec sa date d'expiration. Une alerte colorée apparaît dès qu'un document approche de l'échéance.
**✅ Fonctionnelle** — `driver-drawer.tsx` + `add-driver-modal.tsx`

### 22. Statut en service / hors service
Activez ou désactivez un chauffeur en un clic pour refléter sa disponibilité réelle sans supprimer sa fiche.
**✅ Fonctionnelle** — `driver-drawer.tsx`

---

## GESTION DES VÉHICULES

### 23. Fiche véhicule complète avec alertes de conformité
Renseignez chaque véhicule (immatriculation, marque/modèle depuis une base de données, catégorie, motorisation, couleur) avec ses documents obligatoires : assurance transport à titre onéreux et contrôle technique. Les dates d'expiration sont suivies automatiquement.
**✅ Fonctionnelle** — `vehicle-drawer.tsx` + `add-vehicle-modal.tsx`

### 24. Détection automatique de la catégorie et de la motorisation
Sélectionnez votre marque et modèle dans une liste complète : la catégorie (Berline, SUV, Break, Premium…) et la motorisation (diesel, essence, hybride, électrique) sont pré-remplies automatiquement, sans ressaisie.
**✅ Fonctionnelle** — `vehicle-drawer.tsx` (base `vehicle_models`)

### 25. Alerte ancienneté véhicule (thermique vs électrique)
Pour les motorisations thermiques, NoX calcule l'âge du véhicule et vous alerte dès 5 ans d'ancienneté conformément aux règles VTC. Les véhicules hybrides et électriques bénéficient d'un traitement différencié sans alerte d'âge.
**✅ Fonctionnelle** — `compliance-dot.tsx` logique Guardian Score

---

## ANNUAIRE CLIENTS

### 26. Répertoire clients particuliers et professionnels
Centralisez tous vos clients dans un annuaire unique : particuliers (M./Mme, coordonnées) et professionnels (raison sociale, SIRET, TVA, contacts multiples, adresse de facturation). Chaque fiche affiche l'historique des courses et la date du dernier trajet.
**✅ Fonctionnelle** — `tab-clients.tsx` + `add-client-modal.tsx`

### 27. Marquage VIP
Identifiez vos clients stratégiques avec un tag VIP pour les retrouver et les prioriser en un instant.
**✅ Fonctionnelle** — `tab-clients.tsx`

### 28. Création de bon de commande directement depuis la fiche client
Depuis n'importe quelle fiche client, lancez la création d'un bon de commande avec les coordonnées déjà pré-remplies — zéro ressaisie.
**✅ Fonctionnelle** — `tab-clients.tsx`

---

## PARAMÈTRES & PERSONNALISATION

### 29. Profil entreprise complet (logo, couleur, IBAN)
Personnalisez l'image de votre entreprise : logo, couleur de marque, coordonnées bancaires (IBAN/BIC). Ces éléments apparaissent automatiquement sur tous vos documents PDF.
**✅ Fonctionnelle** — `tab-settings.tsx` → Profil Entreprise

### 30. Grille tarifaire personnalisable
Définissez votre tarif de base (prise en charge, km, attente, minimum), vos majorations horaires (jour, nuit, week-end) et vos forfaits fixes (CDG → Paris, etc.). NoX applique automatiquement ces tarifs lors de la création de vos bons de commande.
**✅ Fonctionnelle** — `tarifs-settings.tsx`

### 31. CGV intégrées aux documents (3 modes)
Configurez vos conditions générales de vente en mode assistant (délais d'annulation, frais, moyens de paiement), en saisie libre ou par import de fichier. Elles s'incluent automatiquement dans chaque bon de commande et facture.
**✅ Fonctionnelle** — `cgv-settings.tsx`

### 32. Préférences de notifications
Choisissez précisément les notifications que vous souhaitez recevoir par email : sécurité, courses, facturation, communications marketing. Vous gardez le contrôle total sur votre boîte mail.
**✅ Fonctionnelle** — `tab-settings.tsx` → Notifications

---

## ABONNEMENTS & CRÉDITS

### 33. Essai gratuit 14 jours — accès complet Premium
Dès l'inscription, profitez de 14 jours d'accès illimité à toutes les fonctionnalités Premium (jusqu'à 10 chauffeurs, 10 véhicules, factures illimitées) sans carte bancaire requise.
**✅ Fonctionnelle** — `subscription-drawer.tsx` + cron `expire-trials`

### 34. Trois plans adaptés à chaque profil

| Plan | Prix | Chauffeurs | Véhicules | Factures |
|---|---|---|---|---|
| **Starter** | Gratuit | 1 | 1 | Crédits à l'unité |
| **Pro** | 4,99 €/mois | 2 | 2 | Illimitées |
| **Premium** | 9,99 €/mois | 10 | 10 | Illimitées |

**✅ Fonctionnelle** — `lib/plans.ts` + `subscription-drawer.tsx`

### 35. Paiement Stripe ou PayPal
Réglez votre abonnement ou vos crédits via Stripe (CB, Apple Pay, Google Pay) ou PayPal selon votre préférence — les deux modes sont disponibles nativement.
**✅ Fonctionnelle** — `/api/stripe/` + `/api/paypal/`

### 36. Crédits factures à l'unité (plan Starter)
Sans abonnement, achetez des crédits à la demande pour générer vos factures PDF au tarif le plus adapté à votre volume (packs de 10, 30 ou 50 crédits avec tarif dégressif).
**✅ Fonctionnelle** — `wallet-drawer.tsx` + `/api/stripe/checkout`

### 37. Code promo
Lors de la souscription, saisissez un code promotionnel pour bénéficier d'une réduction ou d'une période d'essai étendue.
**✅ Fonctionnelle** — `usePromo` hook + `subscription-drawer.tsx`

---

## CONFORMITÉ & RÉGLEMENTATION VTC

### 38. Validation SIRET contre les codes NAF VTC
Lors de l'inscription, votre SIRET est automatiquement vérifié contre les codes d'activité officiels de la profession VTC (4932Z, 4939B). Seules les entreprises VTC déclarées peuvent s'inscrire.
**✅ Fonctionnelle** — `OnboardingComponent.tsx`

### 39. Suivi du Registre VTC et de la carte professionnelle
Renseignez votre numéro d'inscription au registre VTC et votre date d'expiration : NoX vous alerte bien en amont pour que vous ne rouliez jamais hors conformité.
**✅ Fonctionnelle** — `tab-settings.tsx` → Profil Entreprise

---

## NOTIFICATIONS AUTOMATIQUES

### 40. Email de bienvenue et démarrage de l'essai
Dès l'inscription, vous recevez un email de bienvenue personnalisé suivi d'un email de démarrage d'essai avec toutes les informations pour bien débuter.
**✅ Fonctionnelle** — `emails/welcome.tsx` + `emails/trial-start.tsx`

### 41. Rappel de fin d'essai à J-3
Trois jours avant la fin de votre période d'essai, NoX vous envoie un rappel personnalisé pour vous donner le temps de choisir votre formule sans interruption de service.
**✅ Fonctionnelle** — `emails/trial-ending.tsx` + cron `trial-ending`

### 42. Confirmation de changement de plan
Toute modification d'abonnement (mise à niveau, résiliation, expiration) vous est immédiatement confirmée par email avec le détail de votre nouveau statut.
**✅ Fonctionnelle** — `emails/plan-changed.tsx`, `subscription-cancelled.tsx`, `subscription-expired.tsx`

### 43. Notification de sécurité (changement de mot de passe)
En cas de modification de mot de passe, vous recevez immédiatement un email de confirmation. Si vous n'êtes pas à l'origine de ce changement, vous êtes alerté pour sécuriser votre compte.
**✅ Fonctionnelle** — `emails/password-changed.tsx`

---

## SÉCURITÉ & RGPD

### 44. Suppression de compte avec période de réflexion
Demandez la suppression de votre compte avec vérification par code email et délai de 72 heures avant exécution — une sécurité pour éviter toute suppression accidentelle ou malveillante.
**✅ Fonctionnelle** — `account-security/AccountSecurityScreen.tsx` + `emails/account-deletion-*.tsx`

### 45. Bannière de compte en cours de suppression
Si une suppression est en cours, un compteur affiché dans le tableau de bord vous rappelle le délai restant et vous permet d'annuler jusqu'au dernier moment.
**✅ Fonctionnelle** — `tab-dashboard.tsx`

### 46. Isolation totale des données par compte
Toutes vos données (clients, chauffeurs, véhicules, factures) sont strictement isolées par compte via des politiques de sécurité au niveau base de données (Row Level Security Supabase). Aucun autre utilisateur ne peut accéder à vos informations, même en cas d'erreur applicative.
**✅ Fonctionnelle** — `supabase/migrations/` RLS policies

---

## SUPPORT

### 47. Système de tickets de support intégré
Soumettez une demande d'aide directement depuis l'application sans quitter votre tableau de bord : choisissez la catégorie (technique, abonnement, facturation…), décrivez votre problème et joignez une capture d'écran si besoin.
**✅ Fonctionnelle** — `support-ticket-modal.tsx`

### 48. Historique de vos tickets
Retrouvez tous vos échanges passés avec le support avec leur statut (ouvert, en cours, résolu) pour un suivi transparent de chaque demande.
**✅ Fonctionnelle** — `support-history.tsx`

---

## PORTÉE GÉOGRAPHIQUE

### 49. Support téléphonique France, Belgique, Suisse, Luxembourg
La saisie du numéro de téléphone supporte nativement les indicatifs de France (+33), Belgique (+32), Suisse (+41) et Luxembourg (+352), préfigurant une expansion géographique en cours de structuration.
**✅ Fonctionnelle** — `OnboardingComponent.tsx` (indicatifs pays)

---

## CE QUI DISTINGUE NOX VTC

| Spécificité | Détail |
|---|---|
| **Guardian Score** | Seul indicateur propriétaire qui agrège en un chiffre toute votre conformité réglementaire VTC |
| **Factur-X natif** | Standard de facturation électronique européen intégré d'emblée — prêt pour l'obligation 2026 |
| **Validation SIRET VTC** | L'inscription est réservée aux vrais professionnels VTC — aucun imposteur dans la base |
| **Contrats récurrents intelligents** | Gestion des jours fériés, retours, facturation automatique — introuvable dans les outils généralistes |
| **Lien passager sans compte** | Vos clients remplissent leur demande de trajet via un lien — sans créer de compte NoX |
| **100 % France VTC** | APAC, Registre VTC, NAF 4932Z/4939B, micro-entrepreneur TVA — conçu par et pour la profession |

---

## RÉCAPITULATIF DES STATUTS

| Fonctionnalité | Statut | Écran principal |
|---|---|---|
| Onboarding 7 étapes | ✅ | `OnboardingComponent.tsx` |
| Reprise d'inscription | ✅ | `app/page.tsx` |
| Connexion email / mot de passe | ✅ | `AuthScreen.tsx` |
| Connexion Google OAuth | ✅ | `AuthScreen.tsx` |
| Réinitialisation de mot de passe | ✅ | `/app/auth/reset-password` |
| 2FA par email (OTP) | ✅ | `/app/verify-email-code` |
| Tableau de bord principal | ✅ | `tab-dashboard.tsx` |
| Widget prochain trajet | ✅ | `next-trip-widget.tsx` |
| Calendrier des courses | ✅ | `tab-calendar.tsx` |
| Guardian Score (conformité) | ✅ | `compliance-dot.tsx` |
| Création bon de commande | ✅ | `create-bc.tsx` |
| Lien passager sans compte | ✅ | `tab-documents.tsx` |
| Partage SMS/WhatsApp/email | ✅ | `tab-documents.tsx` |
| Cycle de vie réservation (7 états) | ✅ | `tab-documents.tsx` |
| Prestation libre | ✅ | `create-invoice.tsx` |
| Contrats récurrents | ✅ | `recurring-screen.tsx` |
| Génération PDF facture | ✅ | `lib/pdf-generator.ts` |
| Multi-TVA | ✅ | `create-invoice.tsx` |
| Factur-X (facturation électronique) | ✅ | `lib/facturx-*.ts` |
| Suppléments et remises | ✅ | `create-invoice.tsx` |
| Suivi statuts factures | ✅ | `tab-documents.tsx` |
| Fichier chauffeurs + conformité | ✅ | `driver-drawer.tsx` |
| Fichier véhicules + conformité | ✅ | `vehicle-drawer.tsx` |
| Alertes ancienneté véhicule | ✅ | `compliance-dot.tsx` |
| Annuaire clients (part. + pro) | ✅ | `tab-clients.tsx` |
| Tag VIP clients | ✅ | `tab-clients.tsx` |
| Profil entreprise + logo | ✅ | `tab-settings.tsx` |
| Grille tarifaire | ✅ | `tarifs-settings.tsx` |
| CGV (3 modes) | ✅ | `cgv-settings.tsx` |
| Préférences notifications | ✅ | `tab-settings.tsx` |
| Essai gratuit 14 jours Premium | ✅ | `subscription-drawer.tsx` |
| Plans Starter / Pro / Premium | ✅ | `lib/plans.ts` |
| Paiement Stripe + PayPal | ✅ | `/api/stripe/` + `/api/paypal/` |
| Crédits factures à l'unité | ✅ | `wallet-drawer.tsx` |
| Code promo | ✅ | `subscription-drawer.tsx` |
| Validation SIRET NAF VTC | ✅ | `OnboardingComponent.tsx` |
| Suivi Registre VTC | ✅ | `tab-settings.tsx` |
| Emails automatiques (15 templates) | ✅ | `emails/` |
| Rappel fin d'essai J-3 | ✅ | Cron `trial-ending` |
| Suppression compte RGPD (72h) | ✅ | `AccountSecurityScreen.tsx` |
| Isolation données RLS | ✅ | `supabase/migrations/` |
| Tickets support intégrés | ✅ | `support-ticket-modal.tsx` |
| Historique tickets | ✅ | `support-history.tsx` |
| Indicatifs FR/BE/CH/LU | ✅ | `OnboardingComponent.tsx` |
| Analytics chauffeur | 🚧 Partiel | `stats-widget.tsx` |
| Panel d'administration | 🚧 Partiel | `/app/admin/` |
| Multi-langue | 📋 Prévu | — |
| Export comptable / BI | 📋 Prévu | — |

---

*Audit réalisé sur le code source au 23 juillet 2026. Toutes les fonctionnalités ✅ sont présentes et fonctionnelles dans la base de code actuelle. Aucune fonctionnalité fictive ou planifiée n'a été incluse dans les catégories ✅.*

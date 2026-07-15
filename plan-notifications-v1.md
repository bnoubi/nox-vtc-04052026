# Plan d'implémentation — Notifications V1 + Bug trip_confirmation

> Généré le 2026-07-15. À valider avant tout codage.

---

## 1a — Migration SQL `notification_preferences`

Script à exécuter dans Supabase SQL Editor (fichier local : `supabase/migrations/20260715000001_notification_preferences.sql`) :

```sql
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_reservations    BOOLEAN NOT NULL DEFAULT true,
  push_messages        BOOLEAN NOT NULL DEFAULT true,
  push_promotions      BOOLEAN NOT NULL DEFAULT false,
  email_recap          BOOLEAN NOT NULL DEFAULT true,
  email_factures       BOOLEAN NOT NULL DEFAULT true,
  sms_confirmation     BOOLEAN NOT NULL DEFAULT false,
  sms_rappel           BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_owner"
ON public.notification_preferences FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

**Remarques :**
- `sms_confirmation` et `sms_rappel` démarrent à `false` (SMS non implémenté)
- Pas de trigger `updated_at` — mis à jour par la Server Action avec `now()`
- UPSERT côté Server Action (pas de charge au signup)

---

## 1b — Server Action + chargement au montage

**Nouveau fichier `app/actions/notifications.ts` :**
- `getNotifPrefsAction()` : `SELECT *` depuis `notification_preferences` WHERE `user_id = auth.uid()`. Si aucune ligne → retourne les defaults (comportement actuel préservé)
- `saveNotifPrefsAction(prefs)` : UPSERT avec `onConflict: 'user_id'` + `updated_at = now()`

**`NotificationsScreen` dans `tab-settings.tsx` :**
- Remplace `useState` avec valeurs en dur par état initial `null` (loading)
- `useEffect` au montage → `getNotifPrefsAction()` → `setPrefs(data)`
- Chaque `toggle()` appelle `saveNotifPrefsAction()` en fire-and-forget (optimistic update, pas de skeleton)
- Spinner minimal pendant le chargement initial

---

## 1c — Canaux façade : clarification sans casser l'existant

**Ce qui reste fonctionnel (inchangé) :**
- `trip_reminder` et `trip_confirmation` : vrais envois via cron → cloche in-app dans `header.tsx` ✓

**Tableau de décision par toggle :**

| Toggle actuel | Situation réelle | Action |
|---|---|---|
| `pushReservations` | Aucun envoi → façade | Rename "Activité courses", description "Rappels de courses et confirmations" |
| `pushMessages` | Aucun envoi → façade | **Supprimer** (pas de messaging dans l'app) |
| `pushPromotions` | Aucun envoi → façade | Garder — consentement marketing (lié au point 1d) |
| `emailRecap` | Aucun envoi → façade | Garder (fonctionnalité prévue) |
| `emailFactures` | Emails transactionnels réels | **Locked** : lecture seule, `opacity-70`, label "Obligatoire", pas de toggle |
| `smsConfirmation` | Pas de fournisseur SMS | Disabled + badge "Bientôt" |
| `smsRappel` | Pas de fournisseur SMS | Disabled + badge "Bientôt" |

**Résumé changements UI :**
- Section "Push" : 3 → 2 toggles (supprimer `pushMessages`)
- "Réservations" → "Activité courses"
- "Factures" → row non-interactive (cadenas)
- Section SMS : 2 toggles disabled + badge "Bientôt"

---

## 1d — Opt-in RGPD marketing

**Analyse :** Tous les emails de relance d'inactivité (inactifs15, inactifs30, inactifs45) sont traités comme de la prospection commerciale nécessitant un consentement explicite, par prudence RGPD.

**Migration SQL (à exécuter dans Supabase SQL Editor) :**

```sql
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN NOT NULL DEFAULT false;
```

**Cron `app/api/cron/reminders/route.ts` :**
- Les 3 segments `inactifs15`, `inactifs30`, `inactifs45` : join sur `user_accounts.marketing_email_consent = true` avant `sendSegment()`

**UI `NotificationsScreen` :**
- Toggle "Offres et promotions" (titre) / "Recevoir des offres et promotions (push et email)" (description)
- Contrôle à la fois la préférence push et `marketing_email_consent` en base
- `saveNotifPrefsAction` met à jour les deux en une seule action

---

## Bug — `trip_confirmation` disparaît avant choix Oui/Non

### Diagnostic

**Fichier :** `components/dashboard/header.tsx`, ligne 196

```tsx
onClick={() => { setShowNotifs(v => !v); if (!showNotifs) void markAllRead() }}
```

`markAllRead()` marque **toutes** les notifs non-lues comme lues au clic sur la cloche, y compris les `trip_confirmation`. Or les boutons Oui/Non ne s'affichent que si `!n.read` (ligne 234). Résultat : les boutons disparaissent dès l'ouverture du panel.

`confirmTrip()` (ligne 158) marque bien la notif comme lue uniquement après le choix — logique correcte, non touchée.

### Fix

Modifier `markAllRead()` pour exclure les `trip_confirmation` non-résolues :

```tsx
async function markAllRead() {
  const ids = notifications
    .filter(n => !n.read && n.type !== 'trip_confirmation')
    .map(n => n.id)
  if (!ids.length) return
  await supabase.from('notifications').update({ read: true }).in('id', ids)
  setNotifications(prev => prev.map(n =>
    n.type !== 'trip_confirmation' ? { ...n, read: true } : n
  ))
}
```

**Comportement après fix :**
- Ouverture cloche → seules les notifs non-`trip_confirmation` passent en lues (badge rouge disparaît pour elles)
- La `trip_confirmation` reste non-lue (surlignée) avec les boutons Oui/Non visibles
- Clic "Réalisé" ou "Non réalisé" → `confirmTrip()` → marque comme lue + disparaît des boutons
- Clic extérieur (overlay) → ferme le panel sans rien marquer comme lu → correct

### Test en conditions réelles

Une course récurrente existante génère une `trip_confirmation` via le cron. Ouvrir la cloche → les boutons Oui/Non doivent rester visibles. Choisir → la notif passe en lue. Rouvrir la cloche → les boutons n'apparaissent plus.

---

## Fichiers impactés

| Fichier | Modification |
|---|---|
| `supabase/migrations/20260715000001_notification_preferences.sql` | Nouveau — à créer et exécuter manuellement |
| `app/actions/notifications.ts` | Nouveau — getNotifPrefsAction + saveNotifPrefsAction |
| `app/api/cron/reminders/route.ts` | Filtrage `marketing_email_consent` sur `inactifs45` |
| `components/dashboard/tab-settings.tsx` | NotificationsScreen : chargement réel, UI toggles facade |
| `components/dashboard/header.tsx` | markAllRead : exclure trip_confirmation |
| SQL manuel Supabase | ADD COLUMN marketing_email_consent sur user_accounts |

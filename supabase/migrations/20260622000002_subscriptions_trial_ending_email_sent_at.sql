-- Idempotence du cron /api/cron/trial-ending.
-- Set quand l'email "essai se termine dans 2 jours" est envoyé avec succès,
-- pour qu'un second run du cron dans la même fenêtre J+2 (ou un appel manuel)
-- ne renvoie pas un second email au même abonné. Une nouvelle souscription
-- (nouvelle ligne) ré-ouvre la possibilité d'envoyer.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ending_email_sent_at TIMESTAMPTZ;

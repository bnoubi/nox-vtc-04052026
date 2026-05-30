-- Prérequis : extensions pg_cron et pg_net activées dans le dashboard Supabase
-- Remplacer YOUR_CRON_SECRET par la valeur de la variable d'environnement CRON_SECRET

SELECT cron.schedule(
  'nightly-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_get(
    url     := 'https://app.noxvtc.fr/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  ) AS request_id
  $$
);

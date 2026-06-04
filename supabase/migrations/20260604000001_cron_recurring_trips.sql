-- Cron quotidien : génération des trajets récurrents à 5h00 UTC
SELECT cron.schedule(
  'recurring-trips-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.noxvtc.fr/api/cron/recurring-trips',
    headers := jsonb_build_object(
      'Authorization', 'Bearer nox-cron-f90c40da4c8f9f905b8f510945b30018',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);

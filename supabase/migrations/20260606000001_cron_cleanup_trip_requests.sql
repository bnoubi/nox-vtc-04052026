SELECT cron.schedule(
  'cleanup-trip-requests',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.noxvtc.fr/api/cron/cleanup-trip-requests',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "nox-cron-f90c40da4c8f9f905b8f510945b30018"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

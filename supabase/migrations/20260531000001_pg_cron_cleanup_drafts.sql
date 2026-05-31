-- Purge nocturne des BCs brouillon et annulés de plus de 48h
-- Prérequis : extension pg_cron activée dans le dashboard Supabase

SELECT cron.schedule(
  'nightly-cleanup-drafts',
  '0 0 * * *',
  $$
  DELETE FROM bcs
  WHERE status IN ('brouillon', 'annule_client')
    AND created_at < NOW() - INTERVAL '48 hours';
  $$
);

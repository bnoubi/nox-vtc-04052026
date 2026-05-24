-- ─── Subscriptions : pending downgrade fields ────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan TEXT,
  ADD COLUMN IF NOT EXISTS pending_at   TIMESTAMPTZ;

-- ─── User accounts : account_status (active | suspended | deleted) ───────────
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

-- ─── Profiles : soft-delete fields ───────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── Anonymization function (called by pg_cron daily) ────────────────────────
-- Enable pg_cron via Supabase dashboard (Database → Extensions) then run:
--   SELECT cron.schedule('anonymize-deleted-accounts', '0 3 * * *',
--     'SELECT public.anonymize_deleted_accounts()');

CREATE OR REPLACE FUNCTION public.anonymize_deleted_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  -- Anonymize profiles
  UPDATE public.profiles SET
    telephone           = NULL,
    email               = NULL,
    nom_entreprise      = 'Compte supprimé',
    siret               = NULL,
    iban                = NULL,
    bic                 = NULL,
    prenom_representant_legal = NULL,
    nom_representant_legal    = NULL
  WHERE status = 'deleted' AND deleted_at < cutoff;

  -- Anonymize user_accounts
  UPDATE public.user_accounts SET
    full_name = 'Compte supprimé',
    prenom    = NULL,
    nom       = NULL,
    phone     = NULL
  WHERE id IN (
    SELECT user_id FROM public.profiles
    WHERE status = 'deleted' AND deleted_at < cutoff
  );
END;
$$;

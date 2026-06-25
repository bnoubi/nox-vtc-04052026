-- ════════════════════════════════════════════════════════════════════════════
-- Lot 3 — Retombée automatique fin d'essai
--
-- À exécuter MANUELLEMENT dans Supabase Studio → SQL Editor.
-- Ne PAS lancer via `supabase db push` (les blocs cron.* échouent en local sans
-- l'extension pg_cron activée).
--
-- Pré-requis : extension pg_cron déjà active (vérifié : v1.6.4).
-- Idempotent : peut être réexécuté sans casse.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1a. Colonne target_plan sur subscriptions ──────────────────────────────
-- Plan cible après la fin de l'essai. Défaut 'solo' (Starter) ; sera modifié
-- plus tard si l'utilisateur souscrit explicitement à un plan payant avant
-- la fin de l'essai (logique métier hors périmètre Lot 3).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS target_plan TEXT NOT NULL DEFAULT 'solo';

-- Backfill défensif : aligne les lignes existantes (NULL impossible vu le
-- NOT NULL DEFAULT, mais on couvre une éventuelle chaîne vide).
UPDATE public.subscriptions
   SET target_plan = 'solo'
 WHERE target_plan IS NULL
    OR target_plan = '';


-- ─── 1b. Fonction expire_trials ─────────────────────────────────────────────
-- Pour toute subscription dont l'essai a expiré :
--   • status   ← 'active'
--   • plan     ← target_plan (défaut 'solo')
--   • trial_started_at / trial_ends_at / pending_plan / pending_at ← NULL
--   • user_accounts.plan synchronisé avec target_plan
-- Retourne { expired: <int>, at: <timestamp> } pour la traçabilité.

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired int := 0;
BEGIN
  -- CTE chaînée : on bascule d'abord les subscriptions, puis on propage le
  -- plan résultant à user_accounts. La SELECT finale compte les subscriptions
  -- effectivement basculées (pas les comptes — l'écart serait un orphelin).
  WITH expired AS (
    UPDATE public.subscriptions
       SET status           = 'active',
           plan             = COALESCE(NULLIF(target_plan, ''), 'solo'),
           trial_started_at = NULL,
           trial_ends_at    = NULL,
           pending_plan     = NULL,
           pending_at       = NULL
     WHERE status = 'trial'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at < now()
     RETURNING user_id, plan
  ),
  sync_accounts AS (
    UPDATE public.user_accounts ua
       SET plan = e.plan
      FROM expired e
     WHERE ua.id = e.user_id
     RETURNING 1
  )
  SELECT count(*) INTO v_expired FROM expired;

  RETURN jsonb_build_object('expired', v_expired, 'at', now());
END;
$$;


-- ─── 1c. Planification pg_cron — chaque nuit à 02:00 (UTC) ──────────────────
-- pg_cron lit l'heure du serveur Postgres (UTC sur Supabase) ;
-- 02:00 UTC ≈ 03:00 ou 04:00 Europe/Paris selon DST — acceptable pour un
-- traitement de bascule overnight.

-- Désplanifier proprement si un job 'expire-trials' existe déjà
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-trials') THEN
    PERFORM cron.unschedule('expire-trials');
  END IF;
END$$;

SELECT cron.schedule(
  'expire-trials',
  '0 2 * * *',
  $cron$SELECT public.expire_trials();$cron$
);


-- ─── 1d. Vérification ───────────────────────────────────────────────────────
-- Doit retourner UNE ligne avec schedule='0 2 * * *' et active=true.

SELECT jobid, jobname, schedule, command, active
  FROM cron.job
 WHERE jobname = 'expire-trials';

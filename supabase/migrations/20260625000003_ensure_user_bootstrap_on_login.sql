-- ════════════════════════════════════════════════════════════════════════════
-- Trigger ensure_user_bootstrap — création idempotente à chaque login
--
-- À exécuter MANUELLEMENT dans Supabase Studio → SQL Editor.
-- Idempotent : peut être réexécuté sans casse.
--
-- Pourquoi :
--   djsomtou@gmail.com s'est connecté via email/password mais n'a JAMAIS
--   eu de ligne user_accounts ni wallet : (1) le trigger AFTER INSERT
--   auth.users avait silencieusement échoué (corrigé dans
--   20260625000002 par RAISE WARNING), (2) le backfill TS dans
--   /auth/callback est inatteignable depuis le flow signInWithPassword
--   (qui ne passe pas par ce handler HTTP).
--   Ce trigger AFTER UPDATE s'arme à CHAQUE login réussi (last_sign_in_at
--   change), quel que soit le chemin d'auth (password, OAuth, magic link,
--   admin login). Les 3 INSERT sont en ON CONFLICT DO NOTHING — coût
--   marginal sur un login, sécurité maximale.
--
-- Pré-requis externes (déjà couverts si Bernard a passé 20260625000002) :
--   - subscriptions.user_id UNIQUE  ← garde défensive incluse ci-dessous
--   - subscriptions.target_plan     ← idem
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 0. Pré-requis défensifs (idempotents) ──────────────────────────────────
-- Garantissent que les ON CONFLICT (user_id) et l'INSERT sur target_plan
-- ci-dessous fonctionnent même si 20260625000001/000002 n'ont pas été passés
-- avant ce fichier. Ne touchent à rien si déjà en place.

DO $$
BEGIN
  -- target_plan column (cf. 20260625000001)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'subscriptions'
       AND column_name  = 'target_plan'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN target_plan TEXT NOT NULL DEFAULT 'solo';
  END IF;

  -- UNIQUE constraint on subscriptions.user_id (cf. 20260625000002)
  -- Pré-check optionnel avant exécution :
  --   SELECT user_id, COUNT(*) FROM public.subscriptions
  --    GROUP BY user_id HAVING COUNT(*) > 1;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname  = 'subscriptions_user_id_key'
       AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END$$;


-- ─── 1. Fonction ensure_user_bootstrap ──────────────────────────────────────
-- Crée les 3 lignes applicatives si absentes. ON CONFLICT DO NOTHING partout
-- → jamais d'écrasement. EXCEPTION WHEN OTHERS → RAISE WARNING (non
-- silencieux) + RETURN NEW (ne bloque jamais le flow auth Supabase).

CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. user_accounts
  INSERT INTO public.user_accounts (
    id, email, full_name, plan, tokens, onboarding_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ), ''),
    'SOLO',
    0,
    'not_started'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. wallets
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. subscriptions — trial TEAM 14 jours, retombée 'solo'
  INSERT INTO public.subscriptions (
    user_id, plan, status, target_plan, trial_started_at, trial_ends_at
  )
  VALUES (
    NEW.id,
    'TEAM',
    'trial',
    'solo',
    now(),
    now() + interval '14 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_user_bootstrap failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;


-- ─── 2. Trigger on_auth_user_login ──────────────────────────────────────────
-- Fire à CHAQUE connexion réussie (Supabase Auth bump last_sign_in_at).
-- WHEN garantit qu'on ne tire pas inutilement à chaque UPDATE auth.users
-- (e.g. confirmation email, changement de mot de passe).
-- DROP IF EXISTS pour idempotence du fichier.

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

CREATE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.ensure_user_bootstrap();


-- ─── 3. Vérification ────────────────────────────────────────────────────────
-- a. Trigger actif
SELECT tgname, tgenabled, tgrelid::regclass AS "table"
  FROM pg_trigger
 WHERE tgname = 'on_auth_user_login';

-- b. Fonction présente
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE proname = 'ensure_user_bootstrap'
   AND pronamespace = 'public'::regnamespace;

-- c. Test à blanc (optionnel) — provoquer un bump last_sign_in_at sur un
--    user existant et vérifier que les rows manquantes apparaissent :
--    SELECT (SELECT count(*) FROM public.user_accounts WHERE id      = '<UID>') AS ua,
--           (SELECT count(*) FROM public.wallets       WHERE user_id = '<UID>') AS wal,
--           (SELECT count(*) FROM public.subscriptions WHERE user_id = '<UID>') AS sub;

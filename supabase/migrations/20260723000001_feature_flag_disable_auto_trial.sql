-- ════════════════════════════════════════════════════════════════════════════
-- Feature flag disable_auto_trial
--
-- 1. Crée la table app_config si elle n'existe pas (idempotent).
-- 2. Insère la clé disable_auto_trial à 'false' (comportement par défaut
--    inchangé pour tous les abonnés existants).
-- 3. Remplace ensure_user_bootstrap pour lire ce flag au moment de la
--    création de la ligne subscriptions.
--
-- Quand disable_auto_trial = 'true' :
--   → nouvel inscrit reçoit plan=SOLO, status=active (pas d'essai)
-- Quand disable_auto_trial = 'false' (défaut) :
--   → comportement identique à avant : plan=TEAM, status=trial, 14 jours
--
-- À exécuter dans Supabase Studio → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Table app_config ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Clés existantes déjà en production (ne pas écraser leurs valeurs)
INSERT INTO public.app_config (key, value) VALUES
  ('promo_active',        'false'),
  ('promo_percent',       '50'),
  ('promo_coupon_id',     '')
ON CONFLICT (key) DO NOTHING;

-- Nouvelle clé — désactivé par défaut
INSERT INTO public.app_config (key, value) VALUES
  ('disable_auto_trial', 'false')
ON CONFLICT (key) DO NOTHING;

-- RLS : accessible uniquement en lecture par les fonctions internes
-- (le trigger SECURITY DEFINER bypass de toute façon la RLS).
-- Pas de policy anon/authenticated — la table ne doit pas être exposée
-- au frontend.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;


-- ─── 2. Fonction ensure_user_bootstrap — version avec feature flag ───────────
-- SECURITY DEFINER : s'exécute avec les privilèges de son owner (postgres,
-- superuser). Cela garantit deux choses :
--   a) Le SELECT sur app_config est autorisé même si RLS est activée,
--      car un superuser bypass la RLS inconditionnellement.
--   b) Les INSERT sur user_accounts / wallets / subscriptions sont autorisés
--      même si l'utilisateur courant (l'appelant du trigger) n'y a pas accès.
-- Le trigger est AFTER UPDATE ON auth.users → owner = rôle qui a créé la
-- fonction (postgres dans les migrations Supabase) = superuser.

CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_disable_trial BOOLEAN;
BEGIN
  -- Lire le feature flag. Si la ligne n'existe pas, défaut = false
  -- (comportement TEAM/trial inchangé).
  SELECT (value = 'true')
    INTO v_disable_trial
    FROM public.app_config
   WHERE key = 'disable_auto_trial'
   LIMIT 1;

  v_disable_trial := COALESCE(v_disable_trial, false);

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

  -- 3. subscriptions — conditionnel selon le flag
  IF v_disable_trial THEN
    -- Créé directement en Starter actif, sans essai
    INSERT INTO public.subscriptions (
      user_id, plan, status, target_plan,
      trial_started_at, trial_ends_at
    )
    VALUES (
      NEW.id,
      'SOLO',
      'active',
      'solo',
      NULL,
      NULL
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    -- Comportement historique : essai TEAM 14 jours
    INSERT INTO public.subscriptions (
      user_id, plan, status, target_plan,
      trial_started_at, trial_ends_at
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
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_user_bootstrap failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;


-- ─── 3. Vérification immédiate après exécution ───────────────────────────────

-- a. Fonction mise à jour
SELECT proname, prosecdef AS security_definer
  FROM pg_proc
 WHERE proname = 'ensure_user_bootstrap'
   AND pronamespace = 'public'::regnamespace;

-- b. Flag présent avec la bonne valeur par défaut
SELECT key, value
  FROM public.app_config
 WHERE key = 'disable_auto_trial';

-- c. Trigger toujours actif (inchangé — pas de DROP/CREATE nécessaire
--    car on a juste remplacé la fonction, pas le trigger lui-même)
SELECT tgname, tgenabled
  FROM pg_trigger
 WHERE tgname = 'on_auth_user_login';


-- ─── 4. Protocole de test SQL (à exécuter dans Supabase Studio) ──────────────

-- TEST A : flag=false → comportement TEAM/trial inchangé
-- 1. Vérifier que le flag est bien à 'false' :
--    SELECT value FROM app_config WHERE key = 'disable_auto_trial';
--
-- 2. Créer un compte de test via l'interface /register (email + mdp).
--    Ou via SQL Studio → Authentication → Invite user.
--
-- 3. Après connexion du compte, vérifier dans SQL Editor :
--    SELECT user_id, plan, status, trial_ends_at
--      FROM public.subscriptions
--     WHERE user_id = '<UID_DU_COMPTE_TEST>';
--    Résultat attendu : plan='TEAM', status='trial', trial_ends_at = now() + ~14 jours
--
-- 4. Supprimer le compte de test depuis Auth → Users.

-- TEST B : flag=true → SOLO/active sans essai
-- 1. Activer le flag :
--    UPDATE public.app_config SET value = 'true' WHERE key = 'disable_auto_trial';
--
-- 2. Créer un second compte de test (email différent).
--
-- 3. Après connexion, vérifier :
--    SELECT user_id, plan, status, trial_ends_at
--      FROM public.subscriptions
--     WHERE user_id = '<UID_DU_COMPTE_TEST_2>';
--    Résultat attendu : plan='SOLO', status='active', trial_ends_at=NULL
--
-- 4. Remettre le flag à false (ou laisser si c'est le comportement cible) :
--    UPDATE public.app_config SET value = 'false' WHERE key = 'disable_auto_trial';
--
-- 5. Supprimer le compte de test depuis Auth → Users.

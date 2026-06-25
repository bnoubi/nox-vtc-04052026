-- ════════════════════════════════════════════════════════════════════════════
-- Fix CHECK constraints user_accounts.plan / subscriptions.plan
--
-- À exécuter MANUELLEMENT dans Supabase Studio → SQL Editor.
-- Idempotent.
--
-- Pourquoi :
--   user_accounts_plan_check rejette les valeurs en minuscules ('solo',
--   'duo', 'team'). Depuis le Lot 2, le code normalise en minuscules
--   avant d'écrire — la sync user_accounts.plan dans
--   changeSubscriptionPlan échoue silencieusement avec code 23514
--   ("new row violates check constraint user_accounts_plan_check").
--   Logs PM2 : 5 erreurs consécutives sur Patrick (essai upgrade vers
--   'duo') prouvent que ça arrive en prod aujourd'hui.
--   Solution : CHECK insensible à la casse — accepte solo/SOLO/Solo,
--   duo/DUO, team/TEAM.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 0. État actuel des contraintes (lecture) ───────────────────────────────
SELECT conrelid::regclass AS "table",
       conname,
       pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid IN ('public.user_accounts'::regclass, 'public.subscriptions'::regclass)
   AND conname LIKE '%plan_check%';


-- ─── 1. user_accounts.plan : CHECK insensible à la casse ────────────────────
-- Pré-check optionnel avant ALTER (échouera si valeur hors solo/duo/team) :
--   SELECT DISTINCT plan FROM public.user_accounts;

ALTER TABLE public.user_accounts
  DROP CONSTRAINT IF EXISTS user_accounts_plan_check;

ALTER TABLE public.user_accounts
  ADD CONSTRAINT user_accounts_plan_check
  CHECK (lower(plan) = ANY (ARRAY['solo','duo','team']));


-- ─── 2. subscriptions.plan : même traitement si la contrainte existe ────────
-- Conditionnel : ne touche subscriptions_plan_check que si elle existe.
-- Si elle n'existe pas (jamais déclarée), pas d'erreur, pas de no-op
-- destructif — on ne crée PAS la contrainte d'office, vu que la table
-- subscriptions a un historique de valeurs plus large (SOLO/DUO/TEAM/
-- ENTERPRISE legacy possible). Bernard peut décider de la créer après.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname  = 'subscriptions_plan_check'
       AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      DROP CONSTRAINT subscriptions_plan_check;

    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_plan_check
      CHECK (lower(plan) = ANY (ARRAY['solo','duo','team']));
  END IF;
END$$;


-- ─── 3. Vérification ────────────────────────────────────────────────────────
SELECT conrelid::regclass AS "table",
       conname,
       pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid IN ('public.user_accounts'::regclass, 'public.subscriptions'::regclass)
   AND conname LIKE '%plan_check%';

-- Test à blanc : doit retourner 0 row (pas d'erreur)
-- UPDATE public.user_accounts SET plan = lower(plan) WHERE id = '<UID test>';

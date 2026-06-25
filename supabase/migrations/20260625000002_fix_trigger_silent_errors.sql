-- ════════════════════════════════════════════════════════════════════════════
-- Fix triggers silencieux + contrainte UNIQUE subscriptions.user_id
--
-- À exécuter MANUELLEMENT dans Supabase Studio → SQL Editor.
-- Idempotent : peut être réexécuté sans casse.
--
-- Pourquoi :
--   1. Les deux triggers AFTER INSERT ON auth.users avalent toute erreur via
--      EXCEPTION WHEN OTHERS THEN RETURN NEW (sans trace). Si un trigger
--      échoue, on retrouve des comptes orphelins (sans user_accounts ou sans
--      wallet) sans aucun diagnostic possible — c'est ce qui est arrivé à
--      djsomtou@gmail.com (user_accounts NONE, wallet NONE).
--   2. subscriptions.user_id n'a PAS de contrainte UNIQUE (Postgres 42P10
--      confirmé). Le backfill défensif TS du callback utilise upsert ON
--      CONFLICT (user_id) DO NOTHING — il a besoin de cette contrainte pour
--      fonctionner. Tous les users actuels n'ayant qu'1 sub (vérifié),
--      l'ALTER est safe.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. handle_new_user_account : EXCEPTION → RAISE WARNING ─────────────────
-- Corps identique à la version active (20260523000002), seul le bloc EXCEPTION
-- change : on logue l'erreur dans pg_log au lieu de l'avaler silencieusement.
-- Le RETURN NEW est conservé pour ne JAMAIS bloquer la création auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_accounts (
    id, email, full_name, prenom, nom, plan, tokens, onboarding_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ), ''),
    NULLIF(NEW.raw_user_meta_data->>'prenom', ''),
    NULLIF(NEW.raw_user_meta_data->>'nom', ''),
    'SOLO',
    0,
    'not_started'
  )
  ON CONFLICT (id) DO UPDATE SET
    prenom    = COALESCE(EXCLUDED.prenom,    public.user_accounts.prenom),
    nom       = COALESCE(EXCLUDED.nom,       public.user_accounts.nom),
    full_name = COALESCE(EXCLUDED.full_name, public.user_accounts.full_name);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_account failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;


-- ─── 2. handle_new_user_wallet : EXCEPTION → RAISE WARNING ──────────────────
-- Corps identique à la version active (20260616000001) — uniquement le wallet,
-- pas la subscription (déplacée dans /auth/callback depuis le Lot 1).

CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_wallet failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;


-- ─── 3. Contrainte UNIQUE sur subscriptions.user_id ─────────────────────────
-- Pré-requis pour ON CONFLICT (user_id) DO NOTHING dans le backfill TS.
-- Vérification préalable recommandée AVANT exécution :
--   SELECT user_id, COUNT(*) FROM public.subscriptions
--    GROUP BY user_id HAVING COUNT(*) > 1;
-- Si cette requête retourne des lignes, nettoyer d'abord (garder la plus
-- récente) — sinon l'ALTER échouera.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'subscriptions_user_id_key'
       AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END$$;


-- ─── 4. Vérifications ───────────────────────────────────────────────────────

-- a. Confirmer la présence des deux triggers
SELECT tgname, tgrelid::regclass AS table, tgenabled
  FROM pg_trigger
 WHERE tgname IN ('on_auth_user_created', 'on_auth_user_created_wallet');

-- b. Confirmer la contrainte UNIQUE
SELECT conname, contype, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid = 'public.subscriptions'::regclass
   AND contype = 'u';

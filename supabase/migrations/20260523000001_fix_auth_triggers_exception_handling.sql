-- ─── Fix triggers auth : EXCEPTION handler pour ne jamais bloquer la création d'un user ───
-- Contexte : après suppression en cascade d'un user Supabase, la re-création via
-- Google OAuth faisait échouer exchangeCodeForSession car les triggers sans EXCEPTION
-- bloquaient l'INSERT dans auth.users en cas d'erreur (contrainte, table absente, etc.)

-- 1. handle_new_user_account : ajout EXCEPTION WHEN OTHERS
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'un user même si user_accounts échoue
  RETURN NEW;
END;
$$;

-- 2. handle_new_user_wallet : création avec EXCEPTION WHEN OTHERS
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'SOLO', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'un user même si le trigger échoue
  RETURN NEW;
END;
$$;

-- 3. Créer le trigger on_auth_user_created_wallet s'il n'existe pas encore
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_wallet'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created_wallet
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();
  END IF;
END;
$$;

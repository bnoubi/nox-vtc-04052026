-- ─── Fix double subscription au signup ─────────────────────────────────────
-- Contexte : le trigger handle_new_user_wallet créait une subscription
-- (SOLO, active) en même temps que le wallet à l'INSERT auth.users.
-- /auth/callback et /api/auth/webhook tentent ensuite d'insérer (TEAM, trial)
-- mais sont gardés par "if (!existingSub)" — donc la branche trial ne
-- s'exécute jamais et tous les nouveaux comptes restent en SOLO/active
-- au lieu de bénéficier des 14 jours d'essai TEAM.
--
-- Correction : le trigger ne gère plus que le wallet. La création de la
-- subscription redevient la responsabilité du callback / webhook
-- (source unique, plan + dates d'essai cohérents).

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
  RETURN NEW;
END;
$$;

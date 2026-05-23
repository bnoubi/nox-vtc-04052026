-- ─── Trigger handle_new_user_account : persistance prenom/nom depuis les metadata ───
-- Contexte : lors de l'inscription email/mdp, les champs prenom et nom sont transmis
-- dans raw_user_meta_data. Le trigger ne les récupérait pas, laissant user_accounts
-- avec des colonnes vides et forçant l'utilisateur à ressaisir ces données à l'onboarding.

CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_accounts (
    id,
    email,
    full_name,
    prenom,
    nom,
    plan,
    tokens,
    onboarding_status
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
  RETURN NEW;
END;
$$;

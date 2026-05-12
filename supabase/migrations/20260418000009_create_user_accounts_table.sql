CREATE TABLE public.user_accounts (
  id                UUID PRIMARY KEY,
  email             TEXT NOT NULL,
  full_name         TEXT,
  plan              TEXT NOT NULL DEFAULT 'SOLO',
  tokens            INTEGER NOT NULL DEFAULT 0,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  phone             TEXT,
  prenom            TEXT,
  nom               TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.set_user_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_user_accounts_updated_at
  BEFORE UPDATE ON public.user_accounts
  FOR EACH ROW EXECUTE FUNCTION set_user_accounts_updated_at();

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
    'SOLO',
    0,
    'not_started'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account();

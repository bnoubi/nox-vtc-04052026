-- Acceptation obligatoire des CGU/CGV à la dernière étape de l'onboarding.
-- Set lors de finishOnboarding() une fois la case cochée par l'utilisateur.
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS cgu_accepted_at TIMESTAMPTZ;

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN NOT NULL DEFAULT false;

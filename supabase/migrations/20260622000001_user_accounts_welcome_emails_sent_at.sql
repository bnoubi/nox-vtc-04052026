-- Idempotence des emails de bienvenue (welcome + trial-start).
-- Set lors du premier appel POST /api/onboarding/welcome, lu pour empêcher
-- un double envoi si l'utilisateur revient en arrière depuis le step 7
-- et revalide le step 6.
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS welcome_emails_sent_at TIMESTAMPTZ;

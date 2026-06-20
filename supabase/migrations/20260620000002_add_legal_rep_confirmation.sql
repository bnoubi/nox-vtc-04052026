ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS legal_rep_confirmed_at timestamptz;

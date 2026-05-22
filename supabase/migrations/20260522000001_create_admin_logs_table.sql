-- ─── Table admin_logs — journal des actions administrateurs ──────────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action         TEXT NOT NULL,
  admin_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
-- Accès uniquement via service role key (server actions) — aucun accès client direct

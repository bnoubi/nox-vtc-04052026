CREATE TABLE IF NOT EXISTS public.communication_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID,
  segment          TEXT NOT NULL,
  subject          TEXT NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_at          TIMESTAMPTZ DEFAULT now(),
  mode             TEXT NOT NULL DEFAULT 'manual',
  status           TEXT NOT NULL DEFAULT 'sent'
);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communication_logs_admin_all"
ON public.communication_logs
USING (true)
WITH CHECK (true);

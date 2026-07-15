CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_reservations BOOLEAN NOT NULL DEFAULT true,
  push_promotions  BOOLEAN NOT NULL DEFAULT false,
  email_recap      BOOLEAN NOT NULL DEFAULT true,
  email_factures   BOOLEAN NOT NULL DEFAULT true,
  sms_confirmation BOOLEAN NOT NULL DEFAULT false,
  sms_rappel       BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_owner"
ON public.notification_preferences FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

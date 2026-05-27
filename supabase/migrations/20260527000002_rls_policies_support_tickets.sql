-- ─── RLS Policies : support_tickets ──────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_update_own"
  ON public.support_tickets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_delete_own"
  ON public.support_tickets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Storage RLS Policies : bucket "support-attachments" ─────────
-- Upload uniquement dans le dossier {user_id}/* de l'utilisateur connecté

CREATE POLICY "support_attachments_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "support_attachments_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'support-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "support_attachments_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'support-attachments');

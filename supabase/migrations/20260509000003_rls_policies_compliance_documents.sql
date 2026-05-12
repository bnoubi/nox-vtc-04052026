-- ─── RLS Policies : compliance_documents ──────────────────────────
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_documents_select_own"
  ON public.compliance_documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "compliance_documents_insert_own"
  ON public.compliance_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "compliance_documents_update_own"
  ON public.compliance_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "compliance_documents_delete_own"
  ON public.compliance_documents
  FOR DELETE
  USING (auth.uid() = user_id);

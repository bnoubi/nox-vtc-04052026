-- ─── RLS Policies : invoices ──────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own"
  ON public.invoices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_update_own"
  ON public.invoices
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_delete_own"
  ON public.invoices
  FOR DELETE
  USING (auth.uid() = user_id);

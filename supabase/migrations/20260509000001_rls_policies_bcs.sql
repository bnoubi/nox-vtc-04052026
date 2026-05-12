-- ─── RLS Policies : bcs ───────────────────────────────────────────
ALTER TABLE public.bcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bcs_select_own"
  ON public.bcs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bcs_insert_own"
  ON public.bcs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bcs_update_own"
  ON public.bcs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bcs_delete_own"
  ON public.bcs
  FOR DELETE
  USING (auth.uid() = user_id);

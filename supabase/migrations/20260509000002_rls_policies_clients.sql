-- ─── RLS Policies : clients ───────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own"
  ON public.clients
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "clients_insert_own"
  ON public.clients
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_update_own"
  ON public.clients
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_delete_own"
  ON public.clients
  FOR DELETE
  USING (auth.uid() = user_id);

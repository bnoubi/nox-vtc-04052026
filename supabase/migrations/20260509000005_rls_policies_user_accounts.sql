-- ─── RLS Policies : user_accounts ────────────────────────────────
-- user_accounts utilise id comme clé primaire = auth.uid() (pas de colonne user_id séparée)
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_accounts_select_own"
  ON public.user_accounts
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "user_accounts_insert_own"
  ON public.user_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_accounts_update_own"
  ON public.user_accounts
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_accounts_delete_own"
  ON public.user_accounts
  FOR DELETE
  USING (auth.uid() = id);

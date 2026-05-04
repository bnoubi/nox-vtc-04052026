-- ─── RLS Policies : drivers ───────────────────────────────────────
-- Autorise chaque utilisateur à lire UNIQUEMENT ses propres chauffeurs
CREATE POLICY "drivers_select_own"
  ON public.drivers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Autorise chaque utilisateur à créer un chauffeur lié à son compte
CREATE POLICY "drivers_insert_own"
  ON public.drivers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Autorise chaque utilisateur à modifier ses propres chauffeurs
CREATE POLICY "drivers_update_own"
  ON public.drivers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Autorise chaque utilisateur à supprimer ses propres chauffeurs
CREATE POLICY "drivers_delete_own"
  ON public.drivers
  FOR DELETE
  USING (auth.uid() = user_id);

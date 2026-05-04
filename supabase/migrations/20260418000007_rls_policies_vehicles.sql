-- ─── RLS Policies : vehicles ──────────────────────────────────────
-- Autorise chaque utilisateur à lire UNIQUEMENT ses propres véhicules
CREATE POLICY "vehicles_select_own"
  ON public.vehicles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Autorise chaque utilisateur à créer un véhicule lié à son compte
CREATE POLICY "vehicles_insert_own"
  ON public.vehicles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Autorise chaque utilisateur à modifier ses propres véhicules
CREATE POLICY "vehicles_update_own"
  ON public.vehicles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Autorise chaque utilisateur à supprimer ses propres véhicules
CREATE POLICY "vehicles_delete_own"
  ON public.vehicles
  FOR DELETE
  USING (auth.uid() = user_id);

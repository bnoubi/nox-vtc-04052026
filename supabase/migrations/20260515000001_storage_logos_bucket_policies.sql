-- ─── Storage RLS Policies : bucket "logos" ────────────────────────
-- Chaque utilisateur peut lire/écrire/supprimer uniquement son propre dossier {user_id}/*

CREATE POLICY "logos_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'logos');

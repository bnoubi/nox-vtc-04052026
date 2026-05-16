-- Ajoute les colonnes manquantes pour le PDF enrichi (Factur-X)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS trajet JSONB,
  ADD COLUMN IF NOT EXISTS passager_nom TEXT,
  ADD COLUMN IF NOT EXISTS passager_telephone TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type_energie TEXT,
  ADD COLUMN IF NOT EXISTS supplements_list JSONB,
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS client_siren TEXT,
  ADD COLUMN IF NOT EXISTS client_address JSONB;

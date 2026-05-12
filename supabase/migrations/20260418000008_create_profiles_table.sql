CREATE TABLE public.profiles (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  statut_juridique          TEXT,
  nom_entreprise            TEXT,
  siret                     TEXT,
  tva                       TEXT,
  adresse                   TEXT,
  code_postal               TEXT,
  ville                     TEXT,
  complement_adresse        TEXT,
  pays                      TEXT DEFAULT 'France',
  telephone                 TEXT,
  email                     TEXT,
  registre_vtc              TEXT,
  date_registre_vtc         DATE,
  date_assurance_pro        DATE,
  banque                    TEXT,
  iban                      TEXT,
  bic                       TEXT,
  logo_url                  TEXT,
  brand_color               TEXT,
  prenom_representant_legal TEXT,
  nom_representant_legal    TEXT,
  cgv_mode                  TEXT,
  cgv_config                JSONB,
  cgv_text                  TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

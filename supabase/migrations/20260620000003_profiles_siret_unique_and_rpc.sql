-- ─── Anti-doublon entreprise (SIRET/SIREN) ──────────────────────
-- Contexte : la policy RLS profiles_select_own (USING auth.uid()=user_id)
-- empêche tout SELECT cross-user, donc le check côté client renvoyait
-- toujours null. Conséquence : plusieurs utilisateurs ont pu s'inscrire
-- avec la même entreprise (ex. SIREN 840534374).
--
-- Correctif : (1) index UNIQUE partiel comme filet DB,
-- (2) fonction SECURITY DEFINER pour vérifier l'existence sans exposer
-- la table aux autres utilisateurs.

-- 1) Index unique partiel sur siret (ignore les NULL, normal pendant l'onboarding)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_siret_unique
  ON public.profiles (siret)
  WHERE siret IS NOT NULL;

-- 2) RPC sécurisée : renvoie true si un AUTRE user a déjà ce siret
CREATE OR REPLACE FUNCTION public.check_siret_exists(p_siret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE siret = p_siret
      AND user_id <> auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.check_siret_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_siret_exists(TEXT) TO authenticated;

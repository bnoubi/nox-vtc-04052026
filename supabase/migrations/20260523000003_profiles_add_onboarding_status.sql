-- ─── Ajout de onboarding_status dans profiles (source de vérité) ───
-- Contexte : app/page.tsx lisait user_accounts.onboarding_status mais le UPDATE
-- client-side pouvait échouer silencieusement (RLS ou row absente) laissant
-- les abonnés redirigés vers l'onboarding à chaque reconnexion.
-- profiles est la table écrite en dernier lors de l'onboarding (étape 3) et
-- dispose de politiques RLS UPDATE qui autorisent le user — elle devient donc
-- la source de vérité pour onboarding_status.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started';

-- Marquer comme complétés les profils existants d'après user_accounts
UPDATE public.profiles p
SET onboarding_status = 'completed'
FROM public.user_accounts ua
WHERE p.user_id = ua.id
  AND ua.onboarding_status = 'completed';

-- Fallback : profils avec registre_vtc renseigné = onboarding terminé
UPDATE public.profiles
SET onboarding_status = 'completed'
WHERE onboarding_status != 'completed'
  AND registre_vtc IS NOT NULL
  AND registre_vtc != '';

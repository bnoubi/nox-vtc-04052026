-- ─────────────────────────────────────────────────────────────────
-- Migration : normalisation des statuts BCs
-- Ordre safe : migrer les données AVANT d'ajouter la contrainte CHECK
-- ─────────────────────────────────────────────────────────────────

-- Étape 1 : migrer les anciennes valeurs

-- "signe" → "confirme"  (le BC était signé = confirmé, même sémantique)
UPDATE public.bcs
SET status = 'confirme'
WHERE status = 'signe';

-- "annule" → "annule_client"
-- Convention de reprise : origine non traçable dans les anciennes données
UPDATE public.bcs
SET status = 'annule_client'
WHERE status = 'annule';

-- Étape 2 : ajouter la contrainte CHECK sur les 7 statuts officiels
ALTER TABLE public.bcs
  ADD CONSTRAINT bcs_status_check
  CHECK (status IN (
    'brouillon',
    'en_attente',
    'confirme',
    'en_cours',
    'termine',
    'annule_client',
    'annule_chauffeur'
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- Normalise plan → MAJUSCULES dans subscriptions et user_accounts.
--
-- Pourquoi : l'admin back-office écrivait via normalizePlanCode() (lowercase).
-- La convention codebase est UPPERCASE (SOLO/DUO/TEAM).
-- Cette migration corrige les lignes existantes en base.
-- Idempotent : WHERE filtre uniquement les valeurs déjà en minuscules.
-- ════════════════════════════════════════════════════════════════════════════

UPDATE public.subscriptions
   SET plan = UPPER(plan)
 WHERE plan IN ('solo', 'duo', 'team');

UPDATE public.subscriptions
   SET target_plan = UPPER(target_plan)
 WHERE target_plan IN ('solo', 'duo', 'team');

UPDATE public.user_accounts
   SET plan = UPPER(plan)
 WHERE plan IN ('solo', 'duo', 'team');

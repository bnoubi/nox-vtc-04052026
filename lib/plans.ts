// Source unique d'affichage pour plans, statuts, noms et dates d'essai.
// Ne fait jamais d'écriture en base — mappe uniquement les valeurs brutes
// (héritées en MAJUSCULES : SOLO/DUO/TEAM) vers la nomenclature commerciale
// (Starter / Pro / Premium). Les helpers tolèrent toujours null/undefined.

export type PlanCode = 'solo' | 'duo' | 'team'
export type SubStatus = 'trial' | 'active' | 'suspended' | 'expired' | 'deleted'

// TODO Lot 3 : lire depuis app_config ou subscriptions.target_plan.
export const TRIAL_PLAN_CODE: PlanCode = 'team'
export const TRIAL_DURATION_DAYS = 14

export const PLAN_LABEL: Record<PlanCode, string> = {
  solo: 'Starter',
  duo:  'Pro',
  team: 'Premium',
}

// Couleurs hex (compat alpha via `${color}26`) — pas de var(--) ici.
export const PLAN_COLORS: Record<PlanCode, string> = {
  solo: '#6B7280',
  duo:  '#3B82F6',
  team: '#C5A059',
}

export const PLAN_RANK: Record<PlanCode, number> = {
  solo: 1,
  duo:  2,
  team: 3,
}

export const PLAN_OPTIONS: ReadonlyArray<{ value: PlanCode; label: string }> = [
  { value: 'solo', label: 'Starter' },
  { value: 'duo',  label: 'Pro' },
  { value: 'team', label: 'Premium' },
]

const VALID_PLANS: readonly PlanCode[] = ['solo', 'duo', 'team']
const VALID_STATUSES: readonly SubStatus[] = ['trial', 'active', 'suspended', 'expired', 'deleted']

export function normalizePlanCode(raw: string | null | undefined): PlanCode {
  if (!raw) return 'solo'
  const v = raw.trim().toLowerCase()
  return (VALID_PLANS as readonly string[]).includes(v) ? (v as PlanCode) : 'solo'
}

export function planLabel(code: string | null | undefined): string {
  return PLAN_LABEL[normalizePlanCode(code)]
}

export function normalizeSubStatus(raw: string | null | undefined): SubStatus {
  if (!raw) return 'active'
  const v = raw.trim().toLowerCase()
  if (v === 'trialing') return 'trial'
  return (VALID_STATUSES as readonly string[]).includes(v) ? (v as SubStatus) : 'active'
}

export interface EffectivePlanSub {
  plan?: string | null
  status?: string | null
  trial_ends_at?: string | null
}

export function effectivePlan(
  sub: EffectivePlanSub | null | undefined,
  fallback?: string | null,
): PlanCode {
  if (sub) {
    const status = normalizeSubStatus(sub.status ?? null)
    if (status === 'trial') {
      const ends = sub.trial_ends_at
      const trialStillRunning = ends ? new Date(ends).getTime() > Date.now() : false
      if (trialStillRunning) return TRIAL_PLAN_CODE
      // Essai expiré : retombée sur le plan de base (Lot 3 introduira target_plan).
      return normalizePlanCode(fallback ?? null)
    }
    if (sub.plan) return normalizePlanCode(sub.plan)
  }
  if (fallback) return normalizePlanCode(fallback)
  return 'solo'
}

export interface EffectiveStatusAccount { account_status?: string | null }
export interface EffectiveStatusSub { status?: string | null }

export function effectiveStatus(
  account: EffectiveStatusAccount | null | undefined,
  sub: EffectiveStatusSub | null | undefined,
): SubStatus {
  const acc = account?.account_status
  if (acc) {
    const accStatus = normalizeSubStatus(acc)
    if (accStatus !== 'active') return accStatus
  }
  if (sub?.status) return normalizeSubStatus(sub.status)
  return 'active'
}

export interface DisplayNameUA {
  full_name?: string | null
  prenom?: string | null
  nom?: string | null
}
export interface DisplayNameMeta {
  full_name?: string | null
  name?: string | null
}

export function displayName(
  ua: DisplayNameUA | null | undefined,
  meta?: DisplayNameMeta | null,
  email?: string | null,
): string {
  const fn = ua?.full_name?.trim()
  if (fn) return fn
  const parts = `${ua?.prenom ?? ''} ${ua?.nom ?? ''}`.trim()
  if (parts) return parts
  const metaFn = meta?.full_name?.trim() || meta?.name?.trim()
  if (metaFn) return metaFn
  const e = email?.trim()
  if (e) return e
  return '—'
}

const PLAN_DRIVER_VEHICLE_LIMITS: Record<PlanCode, { drivers: number; vehicles: number }> = {
  solo: { drivers: 1, vehicles: 1 },
  duo:  { drivers: 2, vehicles: 2 },
  team: { drivers: 10, vehicles: 10 },
}

export function getPlanLimits(plan: string | null | undefined): { drivers: number; vehicles: number } {
  return PLAN_DRIVER_VEHICLE_LIMITS[normalizePlanCode(plan)]
}

export interface EffectiveTrialDatesSub {
  current_period_start?: string | null
  current_period_end?: string | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
}

export function effectiveTrialDates(
  sub: EffectiveTrialDatesSub | null | undefined,
): { start: string | null; end: string | null } {
  return {
    start: sub?.current_period_start ?? sub?.trial_started_at ?? null,
    end:   sub?.current_period_end   ?? sub?.trial_ends_at    ?? null,
  }
}

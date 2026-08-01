import { useEffect, useState, useCallback } from 'react'
import { useNox } from '@/components/dashboard/nox-context'
import { usePromo } from './usePromo'
import type { PromoConfig } from './usePromo'

export type PromoScenario = 'upgrade' | 'tokens' | null

const STORAGE_KEY    = 'nox_promo_dismissed'
const COOLDOWN_MS    = 24 * 60 * 60 * 1000
const TOKENS_LOW     = 3
const SHOW_DELAY_MS  = 2000

function getDebugScenario(): PromoScenario {
  if (typeof window === 'undefined') return null
  const param = new URLSearchParams(window.location.search).get('debug-promo')
  if (param === 'upgrade') return 'upgrade'
  if (param === 'tokens')  return 'tokens'
  return null
}

function isWithinCooldown(): boolean {
  if (typeof window === 'undefined') return false
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  return Date.now() - parseInt(raw, 10) < COOLDOWN_MS
}

interface UsePromoModalReturn {
  shouldShow: boolean
  scenario: PromoScenario
  promo: PromoConfig
  dismiss: () => void
}

export function usePromoModal(): UsePromoModalReturn {
  const { plan, tokens } = useNox()
  const { promo, loading } = usePromo()
  const [shouldShow, setShouldShow] = useState(false)
  const [scenario, setScenario]     = useState<PromoScenario>(null)

  useEffect(() => {
    if (loading) return

    const debug = getDebugScenario()

    if (debug) {
      setScenario(debug)
      setShouldShow(true)
      return
    }

    if (isWithinCooldown()) return

    let resolved: PromoScenario = null
    if (promo.active && (plan === 'SOLO' || plan === 'DUO')) {
      resolved = 'upgrade'
    } else if (promo.tokensActive && tokens <= TOKENS_LOW) {
      resolved = 'tokens'
    }

    if (!resolved) return

    const timer = setTimeout(() => {
      setScenario(resolved)
      setShouldShow(true)
    }, SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [loading, promo.active, promo.tokensActive, plan, tokens])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
    setShouldShow(false)
  }, [])

  return { shouldShow, scenario, promo, dismiss }
}

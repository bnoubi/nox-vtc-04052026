import { useEffect, useState } from 'react'

export interface PromoConfig {
  active: boolean
  percent: number
  couponId: string
  tokensActive: boolean
}

export function usePromo() {
  const [promo, setPromo] = useState<PromoConfig>({
    active: false,
    percent: 0,
    couponId: '',
    tokensActive: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stripe/promo-config')
      .then(res => res.json())
      .then((data: PromoConfig) => setPromo(data))
      .catch(err => console.error('usePromo error:', err))
      .finally(() => setLoading(false))
  }, [])

  return { promo, loading }
}

import { useEffect, useState } from 'react'

interface PromoConfig {
  active: boolean
  percent: number
  couponId: string
}

export function usePromo() {
  const [promo, setPromo] = useState<PromoConfig>({
    active: false,
    percent: 0,
    couponId: '',
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

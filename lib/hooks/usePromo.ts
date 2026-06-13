import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PromoConfig {
  active: boolean
  percent: number
  couponId: string
}

export function usePromo() {
  const [promo, setPromo] = useState<PromoConfig>({
    active: false,
    percent: 50,
    couponId: '',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPromo = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['promo_active', 'promo_percent', 'promo_coupon_id'])

      if (error) console.error("usePromo error:", error)

      if (data) {
        setPromo({
          active: data.find(c => c.key === 'promo_active')?.value === 'true',
          percent: parseInt(data.find(c => c.key === 'promo_percent')?.value ?? '50'),
          couponId: data.find(c => c.key === 'promo_coupon_id')?.value ?? '',
        })
      }
      setLoading(false)
    }
    fetchPromo()
  }, [])

  return { promo, loading }
}

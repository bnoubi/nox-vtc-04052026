import { unstable_cache } from 'next/cache'
import { stripe } from './client'

export const getCouponPercent = unstable_cache(
  async (couponId: string): Promise<number | null> => {
    try {
      const coupon = await stripe.coupons.retrieve(couponId)
      return coupon.percent_off ?? null
    } catch {
      return null
    }
  },
  ['stripe-coupon-percent'],
  { revalidate: 300 }
)

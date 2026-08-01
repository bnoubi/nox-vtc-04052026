import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCouponPercent } from '@/lib/stripe/promo'

export async function GET() {
  try {
    const { data } = await createAdminClient()
      .from('app_config')
      .select('key, value')
      .in('key', ['promo_active', 'promo_coupon_id', 'promo_tokens_active'])

    const promoActive   = data?.find(c => c.key === 'promo_active')?.value === 'true'
    const couponId      = data?.find(c => c.key === 'promo_coupon_id')?.value ?? ''
    const tokensActive  = data?.find(c => c.key === 'promo_tokens_active')?.value === 'true'

    if (!promoActive || !couponId) {
      return NextResponse.json({ active: false, percent: 0, couponId: '', tokensActive })
    }

    const percent = await getCouponPercent(couponId)

    if (percent === null) {
      return NextResponse.json({ active: false, percent: 0, couponId, tokensActive })
    }

    return NextResponse.json({ active: true, percent, couponId, tokensActive })
  } catch (error) {
    console.error('[stripe/promo-config] error:', error)
    return NextResponse.json({ active: false, percent: 0, couponId: '', tokensActive: false })
  }
}

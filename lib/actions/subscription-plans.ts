'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface SubscriptionPlanDB {
  code: string
  name: string
  price_per_month: number
  stripe_price_id: string | null
  paypal_plan_id: string | null
}

export async function getSubscriptionPlansAction(): Promise<SubscriptionPlanDB[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('subscription_plans')
    .select('code, name, price_per_month, stripe_price_id, paypal_plan_id')
    .in('code', ['DUO', 'TEAM'])
    .order('sort_order')
  if (error) {
    console.error('[subscription-plans] fetch error:', error)
    return []
  }
  return (data ?? []) as SubscriptionPlanDB[]
}

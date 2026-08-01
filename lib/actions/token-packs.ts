'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface TokenPackDB {
  id: string
  nom: string
  quantite_jetons: number
  prix_eur: number
  stripe_price_id: string
  actif: boolean
  ordre_affichage: number
}

export async function getTokenPacksAction(): Promise<TokenPackDB[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('token_packs')
    .select('*')
    .eq('actif', true)
    .order('ordre_affichage')

  if (error) {
    console.error('[token-packs] fetch error:', error)
    return []
  }

  return data as TokenPackDB[]
}

export async function getTokenPackByStripeIdAction(stripeItemType: string): Promise<TokenPackDB | null> {
  const db = createAdminClient()
  const { data } = await db
    .from('token_packs')
    .select('*')
    .or(`id.eq.${stripeItemType},stripe_price_id.eq.${stripeItemType}`)
    .eq('actif', true)
    .maybeSingle()

  return (data as TokenPackDB | null)
}

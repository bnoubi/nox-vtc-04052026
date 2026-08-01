export type PackId = 'pack_decouverte' | 'pack_privilege' | 'pack_prestige'
export type PlanId = 'plan_duo' | 'plan_team'
export type ItemType = PackId | PlanId

export interface TokenPack {
  id: PackId
  uiId: 'decouverte' | 'privilege' | 'prestige'
  name: string
  tokens: number
  price: number
  unit: string
  badge: string | null
  stripeEnvKey: 'STRIPE_PRICE_PACK_5' | 'STRIPE_PRICE_PACK_15' | 'STRIPE_PRICE_PACK_25'
  description: string
}

export interface Plan {
  id: PlanId
  uiId: 'DUO' | 'TEAM'
  name: string
  price: number
  stripeEnvKey: 'STRIPE_PRICE_DUO' | 'STRIPE_PRICE_TEAM'
  description: string
}

export const TOKEN_PACKS: readonly TokenPack[] = [
  {
    id: 'pack_decouverte',
    uiId: 'decouverte',
    name: 'Découverte',
    tokens: 10,
    price: 2,
    unit: '0,20',
    badge: null,
    stripeEnvKey: 'STRIPE_PRICE_PACK_5',
    description: 'Pack Découverte — 10 jetons',
  },
  {
    id: 'pack_privilege',
    uiId: 'privilege',
    name: 'Privilège',
    tokens: 30,
    price: 4,
    unit: '0,13',
    badge: 'Le plus populaire',
    stripeEnvKey: 'STRIPE_PRICE_PACK_15',
    description: 'Pack Privilège — 30 jetons',
  },
  {
    id: 'pack_prestige',
    uiId: 'prestige',
    name: 'Prestige',
    tokens: 50,
    price: 5,
    unit: '0,10',
    badge: 'Meilleure offre',
    stripeEnvKey: 'STRIPE_PRICE_PACK_25',
    description: 'Pack Prestige — 50 jetons',
  },
]

/** @deprecated Prix DB (subscription_plans) fait foi pour PayPal. Conserver pour getPlan() / limit-alert-modal. */
export const SUBSCRIPTION_PLANS: readonly Plan[] = [
  {
    id: 'plan_duo',
    uiId: 'DUO',
    name: 'Pro',
    price: 4.99,
    stripeEnvKey: 'STRIPE_PRICE_DUO',
    description: 'Offre Pro — abonnement mensuel',
  },
  {
    id: 'plan_team',
    uiId: 'TEAM',
    name: 'Premium',
    price: 9.99,
    stripeEnvKey: 'STRIPE_PRICE_TEAM',
    description: 'Offre Premium — abonnement mensuel',
  },
]

export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find(p => p.id === id)
}

export function getPlan(id: string): Plan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === id)
}

export function getItem(id: string): TokenPack | Plan | undefined {
  return getTokenPack(id) ?? getPlan(id)
}

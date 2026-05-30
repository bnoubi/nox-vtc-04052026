import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { CommunicationsClient, type SegmentUser, type SegmentsData, type CommunicationLog } from './_components/communications-client'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type AccountRow = { id: string; email: string | null; full_name: string | null; prenom: string | null; phone: string | null }

async function enrichUsers(supabase: ReturnType<typeof adminClient>, ids: string[]): Promise<AccountRow[]> {
  if (!ids.length) return []
  const { data } = await supabase
    .from('user_accounts')
    .select('id, email, full_name, prenom, phone')
    .in('id', ids)
  return (data ?? []) as AccountRow[]
}

function toUser(
  userId: string,
  email: string,
  acc: AccountRow | undefined,
  contextual: string,
  solde?: number
): SegmentUser {
  const prenom = acc?.prenom ?? acc?.full_name?.split(' ')[0] ?? 'Abonné'
  return {
    userId,
    email: email || acc?.email || '',
    fullName: acc?.full_name ?? '',
    prenom,
    phone: acc?.phone ?? null,
    contextual,
    solde,
  }
}

async function fetchInactifSegments(supabase: ReturnType<typeof adminClient>) {
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const users: User[] = authData?.users ?? []
  const now = Date.now()
  const D = 86_400_000

  const i15 = users.filter(u => { const ms = u.last_sign_in_at ? now - new Date(u.last_sign_in_at).getTime() : 0; return ms >= 15*D && ms < 30*D })
  const i30 = users.filter(u => { const ms = u.last_sign_in_at ? now - new Date(u.last_sign_in_at).getTime() : 0; return ms >= 30*D && ms < 45*D })
  const i45 = users.filter(u => { const ms = u.last_sign_in_at ? now - new Date(u.last_sign_in_at).getTime() : 0; return ms >= 45*D })

  const allIds = [...new Set([...i15, ...i30, ...i45].map(u => u.id))]
  const accounts = await enrichUsers(supabase, allIds)

  function mapUser(u: User): SegmentUser {
    const daysAgo = Math.floor((now - new Date(u.last_sign_in_at!).getTime()) / D)
    const acc = accounts.find(a => a.id === u.id)
    return toUser(u.id, u.email ?? '', acc, `Dernière connexion : il y a ${daysAgo} jour${daysAgo > 1 ? 's' : ''}`)
  }

  return {
    inactifs15: i15.map(mapUser),
    inactifs30: i30.map(mapUser),
    inactifs45: i45.map(mapUser),
  }
}

async function fetchWalletSegments(supabase: ReturnType<typeof adminClient>) {
  const [{ data: epuises }, { data: faibles }] = await Promise.all([
    supabase.from('wallets').select('user_id, balance').eq('balance', 0),
    supabase.from('wallets').select('user_id, balance').gt('balance', 0).lt('balance', 3),
  ])

  const allIds = [...new Set([...(epuises ?? []), ...(faibles ?? [])].map((w: { user_id: string }) => w.user_id))]
  const accounts = await enrichUsers(supabase, allIds)

  return {
    jetonsEpuises: (epuises ?? []).map((w: { user_id: string; balance: number }) => {
      const acc = accounts.find(a => a.id === w.user_id)
      return toUser(w.user_id, acc?.email ?? '', acc, 'Solde : 0 jeton', w.balance)
    }),
    jetonsFaibles: (faibles ?? []).map((w: { user_id: string; balance: number }) => {
      const acc = accounts.find(a => a.id === w.user_id)
      return toUser(w.user_id, acc?.email ?? '', acc, `Solde : ${w.balance} jeton${w.balance > 1 ? 's' : ''}`, w.balance)
    }),
  }
}

async function fetchAboExpires(supabase: ReturnType<typeof adminClient>) {
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end')
    .eq('status', 'expired')

  if (!subs?.length) return { aboExpires: [] }

  const ids = [...new Set(subs.map((s: { user_id: string }) => s.user_id))]
  const accounts = await enrichUsers(supabase, ids)

  return {
    aboExpires: subs.map((s: { user_id: string; current_period_end: string | null }) => {
      const acc = accounts.find(a => a.id === s.user_id)
      const expDate = s.current_period_end
        ? `Expiré le ${new Date(s.current_period_end).toLocaleDateString('fr-FR')}`
        : 'Abonnement expiré'
      return toUser(s.user_id, acc?.email ?? '', acc, expDate)
    }),
  }
}

export default async function CommunicationsPage() {
  const supabase = adminClient()

  const [inactifData, walletData, aboData, { data: rawLogs }] = await Promise.all([
    fetchInactifSegments(supabase),
    fetchWalletSegments(supabase),
    fetchAboExpires(supabase),
    supabase.from('communication_logs').select('*').order('sent_at', { ascending: false }).limit(50),
  ])

  const segments: SegmentsData = { ...inactifData, ...walletData, ...aboData }
  const logs = (rawLogs ?? []) as CommunicationLog[]

  return <CommunicationsClient segments={segments} logs={logs} />
}

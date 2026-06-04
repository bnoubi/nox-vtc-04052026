import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'

const AUTH = process.env.CRON_SECRET ?? 'nox-cron-f90c40da4c8f9f905b8f510945b30018'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${AUTH}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = adminClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // 1. Générer les trajets du jour
    const { data: tripsGenerated } = await adminSupabase
      .rpc('generate_trips_for_date', { p_date: today })

    // 2. Clôturer les contrats dont end_date = hier
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: expiredContracts } = await adminSupabase
      .from('recurring_contracts')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_reason: 'Fin de contrat automatique',
      })
      .eq('status', 'active')
      .eq('end_date', yesterdayStr)
      .eq('no_end_date', false)
      .select('id, numero, label, user_id')

    // 3. Notifier les opérateurs concernés
    if (expiredContracts && expiredContracts.length > 0) {
      const userIds = [...new Set((expiredContracts as { user_id: string }[]).map(c => c.user_id))]
      const { data: authData } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
      const allUsers = authData?.users ?? []

      for (const contract of expiredContracts as { id: string; numero: string; label: string; user_id: string }[]) {
        if (!userIds.includes(contract.user_id)) continue
        const user = allUsers.find(u => u.id === contract.user_id)
        const email = user?.email
        if (!email) continue

        const subject = `Contrat ${contract.numero} terminé`
        const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <p>Votre contrat <strong>${contract.label || contract.numero}</strong> s'est terminé hier.</p>
          <p>Pensez à générer la facture finale depuis le détail du contrat.</p>
          <p><a href="https://app.noxvtc.fr" style="color:#c9a84c">Accéder à NoX VTC</a></p>
        </div>`

        await sendEmail(email, subject, html)
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      tripsGenerated,
      contractsEnded: expiredContracts?.length ?? 0,
    })
  } catch (err) {
    console.error('[cron/recurring-trips]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

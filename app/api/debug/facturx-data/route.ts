import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data } = await supabase
    .from('invoices')
    .select('id, number, amount, amountHT, tva, tvaRate, items')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json(data)
}

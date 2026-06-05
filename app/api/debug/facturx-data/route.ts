import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data } = await supabase
    .from('invoices')
    .select('id, number, amount, amountHT, tva, tvaRate, items')
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json(data)
}

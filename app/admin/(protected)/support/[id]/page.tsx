import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { TicketDetailClient } from './_components/ticket-detail-client'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = adminClient()

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const { data: user } = await supabase
    .from('user_accounts')
    .select('id, email, full_name, phone')
    .eq('id', ticket.user_id)
    .maybeSingle()

  return (
    <div className="space-y-5">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--admin-muted-foreground)' }}
      >
        <ArrowLeft size={15} />
        Retour aux tickets
      </Link>

      <TicketDetailClient ticket={ticket} user={user} />
    </div>
  )
}

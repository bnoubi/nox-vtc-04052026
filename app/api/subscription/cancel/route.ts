import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/resend'
import { subscriptionCancelledEmail } from '@/emails/subscription-cancelled'
import { planLabel } from '@/lib/plans'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = user.id
  const db = createAdminClient()

  const { data: sub, error: subErr } = await db
    .from('subscriptions')
    .select('id, plan, status, stripe_subscription_id, current_period_end, payment_provider, cancel_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subErr) {
    console.error('[subscription/cancel] SELECT error:', subErr)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }
  if (!sub) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })

  const s = sub as {
    id: string
    plan: string
    status: string
    stripe_subscription_id: string | null
    current_period_end: string | null
    payment_provider: string | null
    cancel_at: string | null
  }

  // Idempotent : résiliation déjà demandée
  if (s.cancel_at) {
    return NextResponse.json({ success: true, cancel_at: s.cancel_at })
  }

  const fallbackEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const periodEndIsValid = s.current_period_end && new Date(s.current_period_end).getTime() > Date.now()
  const cancelAt = periodEndIsValid ? s.current_period_end! : fallbackEnd

  // Stripe : programmer l'annulation en fin de période
  if (s.payment_provider === 'stripe' && s.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(s.stripe_subscription_id, { cancel_at_period_end: true })
      console.log('[subscription/cancel] Stripe cancel_at_period_end set — subId:', s.stripe_subscription_id)
    } catch (err) {
      console.error('[subscription/cancel] Stripe update error:', err)
      return NextResponse.json({ error: 'Erreur lors de la communication avec Stripe' }, { status: 500 })
    }
  }

  const { error: updateErr } = await db
    .from('subscriptions')
    .update({
      cancel_at: cancelAt,
      cancellation_reason: 'user_request',
      updated_at: new Date().toISOString(),
    })
    .eq('id', s.id)

  if (updateErr) {
    console.error('[subscription/cancel] UPDATE error:', updateErr)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  console.log('[subscription/cancel] OK — userId:', userId, '| cancel_at:', cancelAt)

  // Email de confirmation
  const { data: account } = await db
    .from('user_accounts')
    .select('email, prenom, nom')
    .eq('id', userId)
    .maybeSingle()

  const acc = account as { email: string | null; prenom: string | null; nom: string | null } | null
  if (acc?.email) {
    const { subject, html } = subscriptionCancelledEmail({
      prenom: acc.prenom ?? '',
      nom:    acc.nom ?? '',
      plan_label: planLabel(s.plan),
      cancel_at: cancelAt,
    })
    const emailResult = await sendEmail(acc.email, subject, html)
    if (!emailResult.success) {
      console.error('[subscription/cancel] email send error:', emailResult.error)
    }
  }

  return NextResponse.json({ success: true, cancel_at: cancelAt })
}

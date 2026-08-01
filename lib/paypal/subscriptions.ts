import { getPayPalAccessToken } from './client'

const BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

export async function createPayPalProduct(name: string): Promise<string> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE_URL}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type: 'SERVICE', category: 'SOFTWARE' }),
  })
  if (!res.ok) throw new Error(`PayPal create product failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { id: string }
  return data.id
}

export async function createPayPalPlan(productId: string, planCode: string, priceEur: number): Promise<string> {
  const token = await getPayPalAccessToken()
  const planName = planCode === 'DUO' ? 'NoX VTC Pro' : 'NoX VTC Premium'
  const res = await fetch(`${BASE_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      name: planName,
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: priceEur.toFixed(2), currency_code: 'EUR' } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  })
  if (!res.ok) throw new Error(`PayPal create plan failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { id: string }
  return data.id
}

export interface PayPalSubscriptionResult {
  subscriptionId: string
  approvalUrl: string
}

export async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string,
  userId: string,
): Promise<PayPalSubscriptionResult> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      application_context: {
        brand_name: 'NoX VTC',
        locale: 'fr-FR',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  })
  if (!res.ok) throw new Error(`PayPal create subscription failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { id: string; links: Array<{ rel: string; href: string }> }
  const approvalLink = data.links.find(l => l.rel === 'approve')
  if (!approvalLink) throw new Error('PayPal: no approval URL in subscription response')
  return { subscriptionId: data.id, approvalUrl: approvalLink.href }
}

export interface PayPalSubscriptionDetails {
  id: string
  status: string
  plan_id: string
  custom_id?: string
  billing_info?: {
    next_billing_time?: string
    last_payment?: { time?: string }
  }
}

export async function getPayPalSubscription(subscriptionId: string): Promise<PayPalSubscriptionDetails> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`PayPal get subscription failed: ${res.status} ${await res.text()}`)
  return await res.json() as PayPalSubscriptionDetails
}

export async function cancelPayPalSubscription(subscriptionId: string, reason: string): Promise<void> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  // 422 = deja annule, on ignore
  if (!res.ok && res.status !== 422) {
    throw new Error(`PayPal cancel subscription failed: ${res.status} ${await res.text()}`)
  }
}

export async function verifyPayPalWebhookSignature(
  headers: Headers,
  body: string,
  webhookId: string,
): Promise<boolean> {
  const token = await getPayPalAccessToken()
  const payload = {
    auth_algo:         headers.get('paypal-auth-algo') ?? '',
    cert_url:          headers.get('paypal-cert-url') ?? '',
    transmission_id:   headers.get('paypal-transmission-id') ?? '',
    transmission_sig:  headers.get('paypal-transmission-sig') ?? '',
    transmission_time: headers.get('paypal-transmission-time') ?? '',
    webhook_id:        webhookId,
    webhook_event:     JSON.parse(body) as unknown,
  }
  const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return false
  const data = await res.json() as { verification_status: string }
  return data.verification_status === 'SUCCESS'
}

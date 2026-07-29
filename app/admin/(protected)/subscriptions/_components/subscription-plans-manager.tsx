'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Crown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface PlanRow {
  code:            string
  name:            string
  price_per_month: number
  stripe_price_id: string | null
  paypal_plan_id:  string | null
}

const INPUT_STYLE = {
  background:  'var(--admin-accent)',
  borderColor: 'var(--admin-border)',
  color:       'var(--admin-foreground)',
}

function truncate(s: string | null, n = 26): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '...' : s
}

export function SubscriptionPlansManager() {
  const [plans, setPlans]       = useState<PlanRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [open, setOpen]         = useState(false)
  const [editCode, setEditCode] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/subscription-plans')
        if (!res.ok) throw new Error()
        setPlans(await res.json())
      } catch {
        toast.error('Impossible de charger les plans')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function refresh() {
    try {
      const res = await fetch('/api/admin/subscription-plans')
      if (res.ok) setPlans(await res.json())
    } catch { /* silent */ }
  }

  function openEdit(plan: PlanRow) {
    setEditCode(plan.code)
    setPriceInput(Number(plan.price_per_month).toFixed(2))
    setOpen(true)
  }

  async function handleSave() {
    if (saving || !editCode) return
    const price = parseFloat(priceInput)
    if (isNaN(price) || price < 0.5) {
      toast.error('Prix invalide (minimum 0,50 EUR)')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/subscription-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode, price_per_month: price }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de la sauvegarde')
        return
      }
      toast.success('Plan mis a jour')
      setOpen(false)
      await refresh()
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setSaving(false)
    }
  }

  const editPlan = plans.find(p => p.code === editCode)

  return (
    <div className="space-y-4">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--admin-muted-foreground)' }}
      >
        Plans d&apos;abonnement
      </p>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--admin-muted-foreground)' }} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                {['Plan', 'Prix / mois', 'Stripe Price ID', 'PayPal Plan ID', ''].map(h => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--admin-muted-foreground)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.code} className="border-b last:border-0" style={{ borderColor: 'var(--admin-border)' }}>
                  <td className="py-3 px-4 font-medium" style={{ color: 'var(--admin-foreground)' }}>
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-muted-foreground)' }} />
                      {plan.name} ({plan.code})
                    </div>
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--admin-foreground)' }}>
                    {Number(plan.price_per_month).toFixed(2)} EUR
                  </td>
                  <td className="py-3 px-4 font-mono text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {truncate(plan.stripe_price_id)}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {truncate(plan.paypal_plan_id)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEdit(plan)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-foreground)' }}
                    >
                      <Pencil className="h-3 w-3" />
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v) }}>
        <DialogContent
          className="border"
          style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--admin-foreground)' }}>
              Modifier le prix — {editPlan?.name ?? editCode}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label style={{ color: 'var(--admin-foreground)' }}>Prix mensuel (EUR)</Label>
              <input
                type="number"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                min={0.5}
                max={999}
                step={0.01}
                placeholder="4.99"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={INPUT_STYLE}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
              Modifier le prix cree un nouveau Price Stripe et un nouveau Plan PayPal.
              Les abonnes existants conservent leur tarif actuel (grandfathering).
            </p>
          </div>

          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg disabled:opacity-50"
              style={{ color: 'var(--admin-muted-foreground)' }}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

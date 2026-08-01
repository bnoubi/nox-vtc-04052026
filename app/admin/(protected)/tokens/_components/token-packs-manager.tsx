'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, Package } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { TokenPackDB } from '@/lib/actions/token-packs'

type PackForm = {
  nom: string
  quantite_jetons: string
  prix_eur: string
  ordre_affichage: string
  actif: boolean
}

const EMPTY_FORM: PackForm = {
  nom: '',
  quantite_jetons: '',
  prix_eur: '',
  ordre_affichage: '0',
  actif: true,
}

const INPUT_STYLE = {
  background: 'var(--admin-accent)',
  borderColor: 'var(--admin-border)',
  color: 'var(--admin-foreground)',
}

export function TokenPacksManager() {
  const [packs, setPacks] = useState<TokenPackDB[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PackForm>(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/token-packs')
        if (!res.ok) throw new Error()
        setPacks(await res.json())
      } catch {
        toast.error('Impossible de charger les packs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function refresh() {
    try {
      const res = await fetch('/api/admin/token-packs')
      if (res.ok) setPacks(await res.json())
    } catch { /* silent */ }
  }

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(pack: TokenPackDB) {
    setEditId(pack.id)
    setForm({
      nom: pack.nom,
      quantite_jetons: String(pack.quantite_jetons),
      prix_eur: String(pack.prix_eur),
      ordre_affichage: String(pack.ordre_affichage),
      actif: pack.actif,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (saving) return
    const prix = parseFloat(form.prix_eur)
    const qte = parseInt(form.quantite_jetons, 10)
    const ordre = parseInt(form.ordre_affichage, 10)
    if (!form.nom.trim() || isNaN(prix) || prix < 0.5 || isNaN(qte) || qte < 1) {
      toast.error('Champs invalides - verifiez nom, prix et quantite')
      return
    }
    setSaving(true)
    try {
      const isEdit = editId !== null
      const payload = isEdit
        ? { id: editId, nom: form.nom.trim(), quantite_jetons: qte, prix_eur: prix, actif: form.actif, ordre_affichage: isNaN(ordre) ? 0 : ordre }
        : { nom: form.nom.trim(), quantite_jetons: qte, prix_eur: prix, ordre_affichage: isNaN(ordre) ? 0 : ordre }
      const res = await fetch('/api/admin/token-packs', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de la sauvegarde')
        return
      }
      toast.success(isEdit ? 'Pack mis a jour' : 'Pack cree avec succes')
      setOpen(false)
      await refresh()
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--admin-muted-foreground)' }}>
          Token Packs
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-foreground)' }}
        >
          <Plus className="h-4 w-4" />
          Ajouter un pack
        </button>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--admin-muted-foreground)' }} />
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
            Aucun pack configure
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                {['Nom', 'Jetons', 'Prix (EUR)', 'Statut', 'Ordre', ''].map(h => (
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
              {packs.map(pack => (
                <tr key={pack.id} className="border-b last:border-0" style={{ borderColor: 'var(--admin-border)' }}>
                  <td className="py-3 px-4 font-medium" style={{ color: 'var(--admin-foreground)' }}>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-muted-foreground)' }} />
                      {pack.nom}
                    </div>
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--admin-foreground)' }}>
                    {pack.quantite_jetons}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--admin-foreground)' }}>
                    {Number(pack.prix_eur).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: pack.actif ? '#22c55e26' : '#71717a26',
                        color: pack.actif ? '#22c55e' : '#71717a',
                      }}
                    >
                      {pack.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {pack.ordre_affichage}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEdit(pack)}
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
              {editId ? 'Modifier le pack' : 'Nouveau pack'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label style={{ color: 'var(--admin-foreground)' }}>Nom</Label>
              <input
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                maxLength={100}
                placeholder="Pack Decouverte"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={INPUT_STYLE}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: 'var(--admin-foreground)' }}>Jetons</Label>
                <input
                  type="number"
                  value={form.quantite_jetons}
                  onChange={e => setForm(f => ({ ...f, quantite_jetons: e.target.value }))}
                  min={1}
                  max={10000}
                  placeholder="10"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: 'var(--admin-foreground)' }}>Prix (EUR)</Label>
                <input
                  type="number"
                  value={form.prix_eur}
                  onChange={e => setForm(f => ({ ...f, prix_eur: e.target.value }))}
                  min={0.5}
                  max={500}
                  step={0.01}
                  placeholder="2.00"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={INPUT_STYLE}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: 'var(--admin-foreground)' }}>Ordre affichage</Label>
              <input
                type="number"
                value={form.ordre_affichage}
                onChange={e => setForm(f => ({ ...f, ordre_affichage: e.target.value }))}
                min={0}
                placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={INPUT_STYLE}
              />
            </div>

            {editId && (
              <div
                className="flex items-center justify-between p-3 rounded-xl border"
                style={{ borderColor: 'var(--admin-border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--admin-foreground)' }}>Pack actif</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${form.actif ? 'bg-emerald-500' : 'bg-gray-600'}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.actif ? 'translate-x-6' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            )}

            {editId && (
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                Modifier le prix cree un nouveau Price Stripe sur le meme Product.
                L&apos;ancien Price reste intact pour conserver l&apos;historique.
              </p>
            )}
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
              {editId ? 'Enregistrer' : 'Creer le pack'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

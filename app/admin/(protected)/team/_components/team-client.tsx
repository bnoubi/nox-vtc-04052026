'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, ShieldOff, UserCog, X, AlertTriangle, Shield, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAdminTeam, createAdminMember, updateMemberRole, revokeAdminMember, resendAdminInvitation,
  type AdminMember, type AdminRole,
} from '../actions'
import { ROLE_CONFIG } from '../role-config'

type Modal =
  | null
  | { type: 'create' }
  | { type: 'changeRole'; member: AdminMember }
  | { type: 'revoke'; member: AdminMember }

function RoleBadge({ code }: { code: string }) {
  const conf = ROLE_CONFIG[code]
  const color = conf?.color ?? '#A1A1AA'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Shield size={10} />
      {conf?.label ?? code}
    </span>
  )
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[200, 140, 110, 110, 130].map((w, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 rounded" style={{ width: w, backgroundColor: 'var(--admin-border)' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function RoleSelect({
  roles, value, onChange, isSuperAdmin, disabledMessage,
}: {
  roles: AdminRole[]
  value: string
  onChange: (v: string) => void
  isSuperAdmin: boolean
  disabledMessage?: string
}) {
  const sorted = [...roles].sort((a, b) => {
    const order = ['super_admin', 'admin', 'support', 'finance']
    return order.indexOf(a.code) - order.indexOf(b.code)
  })
  return (
    <div className="space-y-2">
      {sorted.map(r => {
        const conf = ROLE_CONFIG[r.code]
        const blocked = r.code === 'super_admin' && !isSuperAdmin
        return (
          <label
            key={r.id}
            className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
            style={{
              border: value === r.id ? `1px solid ${conf?.color ?? '#555'}` : '1px solid var(--admin-border)',
              backgroundColor: blocked ? 'transparent' : value === r.id ? `${conf?.color ?? '#555'}11` : 'transparent',
              opacity: blocked ? 0.4 : 1,
              cursor: blocked ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="radio"
              name="role"
              value={r.id}
              checked={value === r.id}
              disabled={blocked}
              onChange={() => !blocked && onChange(r.id)}
              className="mt-1 shrink-0"
            />
            <div>
              <div className="text-sm font-semibold" style={{ color: conf?.color ?? 'var(--admin-foreground)' }}>
                {conf?.label ?? r.code}
                {r.code === 'super_admin' && !isSuperAdmin && (
                  <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--admin-muted-foreground)' }}>
                    (réservé aux super_admin)
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--admin-muted-foreground)' }}>
                {conf?.description ?? ''}
              </div>
            </div>
          </label>
        )
      })}
      {disabledMessage && (
        <p className="text-xs" style={{ color: '#ef4444' }}>{disabledMessage}</p>
      )}
    </div>
  )
}

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-xl border shadow-2xl" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-muted-foreground)' }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ConfirmField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
        Action irréversible sur un compte super_admin. Tapez <strong>CONFIRMER</strong> pour continuer.
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="CONFIRMER"
        className="w-full px-3 py-2 rounded-lg text-sm font-mono"
        style={{ background: 'var(--admin-background)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--admin-foreground)' }}
      />
    </div>
  )
}

export function TeamClient({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter()
  const [members, setMembers] = useState<AdminMember[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [saving, setSaving] = useState(false)

  // Create form state
  const [createEmail, setCreateEmail] = useState('')
  const [createPrenom, setCreatePrenom] = useState('')
  const [createNom, setCreateNom] = useState('')
  const [createRoleId, setCreateRoleId] = useState('')

  // Change role state
  const [changeRoleId, setChangeRoleId] = useState('')

  // BUG 4b: confirmation text for super_admin operations
  const [confirmText, setConfirmText] = useState('')

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminTeam()
      setMembers(res.members)
      setRoles(res.roles)
      if (!createRoleId && res.roles.length > 0) {
        const adminRole = res.roles.find(r => r.code === 'admin')
        setCreateRoleId(adminRole?.id ?? res.roles[0].id)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  function openCreate() {
    setCreateEmail('')
    setCreatePrenom('')
    setCreateNom('')
    const adminRole = roles.find(r => r.code === 'admin')
    setCreateRoleId(adminRole?.id ?? roles[0]?.id ?? '')
    setModal({ type: 'create' })
  }

  function openChangeRole(member: AdminMember) {
    setChangeRoleId(member.roleId)
    setConfirmText('')
    setModal({ type: 'changeRole', member })
  }

  function openRevoke(member: AdminMember) {
    setConfirmText('')
    setModal({ type: 'revoke', member })
  }

  async function handleCreate() {
    if (!createEmail.trim() || !createRoleId) return
    setSaving(true)
    const res = await createAdminMember(createEmail.trim(), createPrenom.trim(), createNom.trim(), createRoleId)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Invitation envoyée')
    setModal(null)
    fetchTeam()
  }

  async function handleChangeRole() {
    if (modal?.type !== 'changeRole') return
    setSaving(true)
    const res = await updateMemberRole(modal.member.id, changeRoleId)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Rôle mis à jour')
    setModal(null)
    fetchTeam()
  }

  async function handleRevoke() {
    if (modal?.type !== 'revoke') return
    setSaving(true)
    const res = await revokeAdminMember(modal.member.id)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Accès révoqué')
    setModal(null)
    fetchTeam()
  }

  async function handleResend(member: AdminMember) {
    setSaving(true)
    const res = await resendAdminInvitation(member.userId)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Invitation renvoyée')
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
          {loading ? '…' : `${members.length} compte${members.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={fetchTeam}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
          >
            <Plus size={15} />
            Créer un accès
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--admin-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-card)' }}>
              {['Email', 'Prénom / Nom', 'Rôle', 'Attribué le', 'Dernière connexion', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton />
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Erreur de chargement
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Aucun compte admin
                </td>
              </tr>
            ) : (
              members.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--admin-border)' }}>
                  <td className="py-3 px-4 font-medium" style={{ color: 'var(--admin-foreground)' }}>{m.email}</td>
                  <td className="py-3 px-4" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {[m.prenom, m.nom].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="py-3 px-4"><RoleBadge code={m.roleCode} /></td>
                  <td className="py-3 px-4 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{formatDate(m.assignedAt)}</td>
                  <td className="py-3 px-4 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{formatDate(m.lastSignIn)}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      {/* BUG 3: Renvoyer invitation (jamais connecté) */}
                      {m.lastSignIn === null && (
                        <button
                          onClick={() => handleResend(m)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border disabled:opacity-50"
                          style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
                          title="Renvoyer l'invitation"
                        >
                          <Send size={12} />
                          Renvoyer
                        </button>
                      )}
                      <button
                        onClick={() => openChangeRole(m)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border"
                        style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
                        title="Modifier le rôle"
                      >
                        <UserCog size={12} />
                        Rôle
                      </button>
                      <button
                        onClick={() => openRevoke(m)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        title="Révoquer l'accès"
                      >
                        <ShieldOff size={12} />
                        Révoquer
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal : Créer */}
      {modal?.type === 'create' && (
        <ModalWrapper title="Créer un accès admin" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>
                Email <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                placeholder="prenom.nom@example.com"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Prénom</label>
                <input
                  type="text"
                  value={createPrenom}
                  onChange={e => setCreatePrenom(e.target.value)}
                  placeholder="Prénom"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Nom</label>
                <input
                  type="text"
                  value={createNom}
                  onChange={e => setCreateNom(e.target.value)}
                  placeholder="Nom"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Rôle</label>
              <RoleSelect roles={roles} value={createRoleId} onChange={setCreateRoleId} isSuperAdmin={isSuperAdmin} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !createEmail.trim() || !createRoleId}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              >
                {saving ? 'Envoi…' : 'Créer et envoyer l\'invitation'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Modal : Modifier le rôle */}
      {modal?.type === 'changeRole' && (() => {
        const isDemotingSuperAdmin = modal.member.roleCode === 'super_admin' && changeRoleId !== modal.member.roleId
        const confirmRequired = isDemotingSuperAdmin
        const canSubmit = !saving && changeRoleId !== modal.member.roleId && (!confirmRequired || confirmText === 'CONFIRMER')
        return (
          <ModalWrapper title={`Modifier le rôle — ${modal.member.email}`} onClose={() => setModal(null)}>
            <div className="space-y-4">
              <RoleSelect roles={roles} value={changeRoleId} onChange={v => { setChangeRoleId(v); setConfirmText('') }} isSuperAdmin={isSuperAdmin} />
              {/* BUG 4b: CONFIRMER pour rétrogradation super_admin */}
              {isDemotingSuperAdmin && (
                <ConfirmField value={confirmText} onChange={setConfirmText} />
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
                  Annuler
                </button>
                <button
                  onClick={handleChangeRole}
                  disabled={!canSubmit}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
                >
                  {saving ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </ModalWrapper>
        )
      })()}

      {/* Modal : Révoquer */}
      {modal?.type === 'revoke' && (() => {
        const isSuperAdminTarget = modal.member.roleCode === 'super_admin'
        const canSubmit = !saving && (!isSuperAdminTarget || confirmText === 'CONFIRMER')
        return (
          <ModalWrapper title="Révoquer l'accès admin" onClose={() => setModal(null)}>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
                  <p className="font-semibold">Vous allez révoquer l'accès de :</p>
                  <p className="mt-1" style={{ color: '#ef4444' }}>{modal.member.email}</p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                    Le compte auth n'est pas supprimé — seul l'accès admin est retiré. Effet immédiat à la prochaine requête.
                  </p>
                </div>
              </div>
              {/* BUG 4b: CONFIRMER pour révocation super_admin */}
              {isSuperAdminTarget && (
                <ConfirmField value={confirmText} onChange={setConfirmText} />
              )}
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
                  Annuler
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={!canSubmit}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  {saving ? 'Révocation…' : 'Confirmer la révocation'}
                </button>
              </div>
            </div>
          </ModalWrapper>
        )
      })()}
    </>
  )
}

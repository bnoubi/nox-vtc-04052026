'use server'

import { createClient as createSbClient } from '@supabase/supabase-js'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { adminInvitationEmail } from '@/emails/admin-invitation'
import { revalidatePath } from 'next/cache'

export interface AdminMember {
  id: string
  userId: string
  email: string
  prenom: string | null
  nom: string | null
  roleId: string
  roleCode: string
  permissions: string[]
  assignedAt: string
  lastSignIn: string | null
}

export interface AdminRole {
  id: string
  code: string
  name: string
  permissions: string[]
}

export const ROLE_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Accès total à toutes les fonctionnalités du back-office',
    color: '#a855f7',
  },
  admin: {
    label: 'Admin',
    description: 'Gestion complète — utilisateurs, abonnements, jetons, analytics, tickets',
    color: '#C9A84C',
  },
  support: {
    label: 'Support',
    description: 'Consultation des utilisateurs et abonnements, gestion des tickets',
    color: '#3b82f6',
  },
  finance: {
    label: 'Finance',
    description: 'Consultation des abonnements, paiements et analytics',
    color: '#22c55e',
  },
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const db = createAdminClient()
  const { data } = await db.from('admin_roles').select('id, code, name, permissions').order('code')
  return (data ?? []) as AdminRole[]
}

export async function getAdminTeam(): Promise<{ members: AdminMember[]; roles: AdminRole[] }> {
  const auth = await verifyAdminPermission('admins.read')
  if (!auth.authorized) return { members: [], roles: [] }

  const db = createAdminClient()
  const sbAdmin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userRoles } = await db
    .from('user_roles')
    .select('id, user_id, admin_role_id, assigned_at, admin_roles!admin_role_id(id, code, name, permissions)')
    .order('assigned_at', { ascending: false })

  if (!userRoles?.length) {
    const roles = await getAdminRoles()
    return { members: [], roles }
  }

  const userIds = (userRoles as { user_id: string }[]).map(r => r.user_id)

  const [{ data: accounts }, ...authResults] = await Promise.all([
    db.from('user_accounts').select('id, email, prenom, nom').in('id', userIds),
    ...userIds.map(id => sbAdmin.auth.admin.getUserById(id)),
  ])

  const accountMap: Record<string, { email: string; prenom: string | null; nom: string | null }> = {}
  for (const a of (accounts ?? []) as { id: string; email: string; prenom: string | null; nom: string | null }[]) {
    accountMap[a.id] = a
  }

  const authMap: Record<string, { last_sign_in_at: string | null }> = {}
  for (const r of authResults) {
    const u = (r as { data?: { user?: { id: string; last_sign_in_at?: string } } }).data?.user
    if (u?.id) authMap[u.id] = { last_sign_in_at: u.last_sign_in_at ?? null }
  }

  const members: AdminMember[] = (userRoles as {
    id: string
    user_id: string
    admin_role_id: string
    assigned_at: string
    admin_roles: { id: string; code: string; permissions: string[] } | null
  }[]).map(r => {
    const acc = accountMap[r.user_id]
    const auth = authMap[r.user_id]
    const roleInfo = r.admin_roles
    return {
      id: r.id,
      userId: r.user_id,
      email: acc?.email ?? '',
      prenom: acc?.prenom ?? null,
      nom: acc?.nom ?? null,
      roleId: r.admin_role_id,
      roleCode: roleInfo?.code ?? '',
      permissions: roleInfo?.permissions ?? [],
      assignedAt: r.assigned_at,
      lastSignIn: auth?.last_sign_in_at ?? null,
    }
  })

  const roles = await getAdminRoles()
  return { members, roles }
}

export async function createAdminMember(
  email: string,
  prenom: string,
  nom: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()
  const sbAdmin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Guard : seul super_admin peut créer un super_admin
  const { data: targetRole } = await db.from('admin_roles').select('code').eq('id', roleId).single()
  if (targetRole?.code === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut attribuer le rôle super_admin.' }
  }

  // Email de l'admin qui invite (pour l'email d'invitation)
  const { data: inviterAcc } = await db
    .from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle()
  const invitedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId

  const fullName = [prenom, nom].filter(Boolean).join(' ').trim()

  // Génération du lien d'invitation (crée l'utilisateur dans auth.users)
  const { data: linkData, error: linkError } = await sbAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { full_name: fullName || undefined },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=invite`,
    },
  })

  if (linkError || !linkData) {
    return { success: false, error: linkError?.message ?? 'Erreur lors de la génération du lien.' }
  }

  const userId = linkData.user.id
  const inviteLink = linkData.properties.action_link

  // Forcer onboarding_status='completed' pour éviter la redirection onboarding
  await Promise.all([
    db.from('user_accounts').upsert(
      {
        id: userId,
        email,
        full_name: fullName || null,
        prenom: prenom || null,
        nom: nom || null,
        plan: 'SOLO',
        tokens: 0,
        onboarding_status: 'completed',
        onboarding_step: 99,
        account_status: 'active',
      },
      { onConflict: 'id' }
    ),
    db.from('profiles').upsert(
      { user_id: userId, email, onboarding_status: 'completed' },
      { onConflict: 'user_id' }
    ),
  ])

  // Attribution du rôle
  const { error: roleError } = await db.from('user_roles').insert({
    user_id: userId,
    admin_role_id: roleId,
    assigned_by: auth.adminId,
  })
  if (roleError) return { success: false, error: `Erreur attribution rôle : ${roleError.message}` }

  // Log
  await db.from('admin_logs').insert({
    admin_id: auth.adminId,
    action: 'create_admin',
    target_user_id: userId,
    new_values: { email, role_id: roleId, role_code: targetRole?.code },
  })

  // Email brandé Resend
  const roleConf = ROLE_CONFIG[targetRole?.code ?? '']
  const { subject, html } = adminInvitationEmail({
    prenom: prenom || email.split('@')[0],
    nom: nom || '',
    roleLabel: roleConf?.label ?? targetRole?.code ?? '',
    roleDescription: roleConf?.description ?? '',
    invitedByEmail,
    inviteLink,
  })
  await sendEmail(email, subject, html)

  revalidatePath('/admin/team')
  return { success: true }
}

export async function updateMemberRole(
  userRoleId: string,
  newRoleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()

  // Guard : seul super_admin peut attribuer ou retirer le rôle super_admin
  const { data: newRole } = await db.from('admin_roles').select('code').eq('id', newRoleId).single()
  if (newRole?.code === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut attribuer le rôle super_admin.' }
  }

  const { data: existing } = await db
    .from('user_roles').select('user_id, admin_role_id, admin_roles!admin_role_id(code)').eq('id', userRoleId).single()
  const existingCode = (existing as { admin_roles: { code: string } | null } | null)?.admin_roles?.code
  if (existingCode === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut modifier un compte super_admin.' }
  }

  const { error } = await db.from('user_roles').update({ admin_role_id: newRoleId }).eq('id', userRoleId)
  if (error) return { success: false, error: error.message }

  const targetUserId = (existing as { user_id: string } | null)?.user_id
  if (targetUserId) {
    await db.from('admin_logs').insert({
      admin_id: auth.adminId,
      action: 'update_admin_role',
      target_user_id: targetUserId,
      new_values: { old_role_code: existingCode, new_role_id: newRoleId, new_role_code: newRole?.code },
    })
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function revokeAdminMember(
  userRoleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()

  const { data: existing } = await db
    .from('user_roles').select('user_id, admin_roles!admin_role_id(code)').eq('id', userRoleId).single()
  const existingCode = (existing as { admin_roles: { code: string } | null } | null)?.admin_roles?.code

  if (existingCode === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut révoquer un compte super_admin.' }
  }

  const { error } = await db.from('user_roles').delete().eq('id', userRoleId)
  if (error) return { success: false, error: error.message }

  const targetUserId = (existing as { user_id: string } | null)?.user_id
  if (targetUserId) {
    await db.from('admin_logs').insert({
      admin_id: auth.adminId,
      action: 'revoke_admin',
      target_user_id: targetUserId,
      new_values: { revoked_role_code: existingCode },
    })
  }

  revalidatePath('/admin/team')
  return { success: true }
}

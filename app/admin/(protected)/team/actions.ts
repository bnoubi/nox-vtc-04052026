'use server'

import { createClient as createSbClient } from '@supabase/supabase-js'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { adminInvitationEmail } from '@/emails/admin-invitation'
import { adminRoleChangedEmail } from '@/emails/admin-role-changed'
import { revalidatePath } from 'next/cache'
import { ROLE_CONFIG } from './role-config'

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
    ...userIds.map(id =>
      sbAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null }, error: null }))
    ),
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

  const { data: targetRole } = await db.from('admin_roles').select('code').eq('id', roleId).single()
  if (targetRole?.code === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut attribuer le rôle super_admin.' }
  }

  const { data: inviterAcc } = await db
    .from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle()
  const invitedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId

  const fullName = [prenom, nom].filter(Boolean).join(' ').trim()

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

  const { error: roleError } = await db.from('user_roles').insert({
    user_id: userId,
    admin_role_id: roleId,
    assigned_by: auth.adminId,
  })
  if (roleError) return { success: false, error: `Erreur attribution rôle : ${roleError.message}` }

  await db.from('admin_logs').insert({
    admin_id: auth.adminId,
    action: 'create_admin',
    target_user_id: userId,
    new_values: { email, role_id: roleId, role_code: targetRole?.code },
  })

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

export async function resendAdminInvitation(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()
  const sbAdmin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: acc } = await db
    .from('user_accounts').select('email, prenom, nom').eq('id', userId).maybeSingle()
  if (!acc) return { success: false, error: 'Utilisateur introuvable.' }

  const { data: roleRow } = await db
    .from('user_roles')
    .select('admin_roles!admin_role_id(code)')
    .eq('user_id', userId)
    .maybeSingle()
  const roleCode = (roleRow as unknown as { admin_roles: { code: string } | null })?.admin_roles?.code ?? ''

  const memberAcc = acc as { email: string; prenom: string | null; nom: string | null }
  const fullName = [memberAcc.prenom, memberAcc.nom].filter(Boolean).join(' ').trim()

  const { data: linkData, error: linkError } = await sbAdmin.auth.admin.generateLink({
    type: 'invite',
    email: memberAcc.email,
    options: {
      data: { full_name: fullName || undefined },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=invite`,
    },
  })

  if (linkError || !linkData) {
    return { success: false, error: linkError?.message ?? 'Erreur lors de la génération du lien.' }
  }

  const inviteLink = linkData.properties.action_link

  const { data: inviterAcc } = await db
    .from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle()
  const invitedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId

  const roleConf = ROLE_CONFIG[roleCode]
  const { subject, html } = adminInvitationEmail({
    prenom: memberAcc.prenom || memberAcc.email.split('@')[0],
    nom: memberAcc.nom || '',
    roleLabel: roleConf?.label ?? roleCode,
    roleDescription: roleConf?.description ?? '',
    invitedByEmail,
    inviteLink,
  })
  await sendEmail(memberAcc.email, subject, html)

  await db.from('admin_logs').insert({
    admin_id: auth.adminId,
    action: 'resend_admin_invitation',
    target_user_id: userId,
    new_values: { email: memberAcc.email, role_code: roleCode },
  })

  return { success: true }
}

async function countSuperAdmins(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: saRole } = await db.from('admin_roles').select('id').eq('code', 'super_admin').maybeSingle()
  if (!saRole) return 0
  const { count } = await db
    .from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('admin_role_id', (saRole as { id: string }).id)
  return count ?? 0
}

export async function updateMemberRole(
  userRoleId: string,
  newRoleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()

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

  // BUG 4a: dernier super_admin
  if (existingCode === 'super_admin' && newRole?.code !== 'super_admin') {
    const remaining = await countSuperAdmins(db)
    if (remaining <= 1) {
      return { success: false, error: 'Impossible : ce compte est le dernier super_admin. Promouvez un autre admin en super_admin avant de rétrograder celui-ci.' }
    }
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

    try {
      const [{ data: memberAcc }, { data: inviterAcc }] = await Promise.all([
        db.from('user_accounts').select('email, prenom, nom').eq('id', targetUserId).maybeSingle(),
        db.from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle(),
      ])
      if (memberAcc) {
        const m = memberAcc as { email: string; prenom: string | null; nom: string | null }
        const changedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId
        const oldConf = ROLE_CONFIG[existingCode ?? '']
        const newConf = ROLE_CONFIG[newRole?.code ?? '']
        const { subject, html } = adminRoleChangedEmail({
          event: 'role_change',
          prenom: m.prenom ?? '',
          nom: m.nom ?? '',
          memberEmail: m.email,
          oldRoleLabel: oldConf?.label ?? existingCode ?? '',
          newRoleLabel: newConf?.label ?? newRole?.code ?? '',
          newRoleColor: newConf?.color ?? '#A1A1AA',
          changedByEmail,
        })
        const emailResult = await sendEmail(m.email, subject, html)
        if (!emailResult.success) {
          console.error('[team/updateMemberRole] email notification erreur:', emailResult.error)
        }
      }
    } catch (emailErr) {
      console.error('[team/updateMemberRole] email notification exception (mise à jour en base OK):', emailErr)
    }
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

  // BUG 4a: dernier super_admin
  if (existingCode === 'super_admin') {
    const remaining = await countSuperAdmins(db)
    if (remaining <= 1) {
      return { success: false, error: 'Impossible : ce compte est le dernier super_admin. Promouvez un autre admin en super_admin avant de révoquer celui-ci.' }
    }
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

    try {
      const [{ data: memberAcc }, { data: inviterAcc }] = await Promise.all([
        db.from('user_accounts').select('email, prenom, nom').eq('id', targetUserId).maybeSingle(),
        db.from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle(),
      ])
      if (memberAcc) {
        const m = memberAcc as { email: string; prenom: string | null; nom: string | null }
        const revokedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId
        const roleConf = ROLE_CONFIG[existingCode ?? '']
        const { subject, html } = adminRoleChangedEmail({
          event: 'revoke',
          prenom: m.prenom ?? '',
          nom: m.nom ?? '',
          memberEmail: m.email,
          revokedRoleLabel: roleConf?.label ?? existingCode ?? '',
          revokedByEmail,
        })
        const emailResult = await sendEmail(m.email, subject, html)
        if (!emailResult.success) {
          console.error('[team/revokeAdminMember] email notification erreur:', emailResult.error)
        }
      }
    } catch (emailErr) {
      console.error('[team/revokeAdminMember] email notification exception (révocation en base OK):', emailErr)
    }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

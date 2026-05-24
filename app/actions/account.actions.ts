'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function deleteUserAccount() {
  const supabase = await createClient()
  
  // 1. Resolve user ID from authenticated session
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Utilisateur non authentifié.' }
  }
  
  const userId = user.id

  // 2. Prepare Admin Client
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    }
  )

  // Soft-delete : données conservées 30 jours pour obligations légales.
  // anonymize_deleted_accounts() (pg_cron) anonymise après 30 jours.
  const now = new Date().toISOString()

  const { error: profileError } = await supabaseAdmin
    .from('profiles').update({ status: 'deleted', deleted_at: now }).eq('user_id', userId)
  if (profileError) return { error: profileError.message }

  await supabaseAdmin.from('user_accounts').update({ account_status: 'deleted' }).eq('id', userId)

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (banError) return { error: banError.message }

  return { success: true }
}

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

  // 3. Documentation métier sur la suppression
  // - Les entités métier (conducteurs, véhicules, BC, factures, clients) sont 
  //   actuellement stockées dans le localStorage de l'appareil. Elles sont perdues 
  //   en cas de déconnexion/vidage de cache ou suppression, mais n'encombrent pas le serveur.
  // - Le profil entreprise (profiles) et (user_accounts) dans Supabase doivent 
  //   avoir une contrainte de clé étrangère avec 'ON DELETE CASCADE' pour être 
  //   nettoyés automatiquement lors de la suppression du user de 'auth.users'.
  //   Si ce n'est pas le cas, un traitement croisé explicite sera nécessaire ici avant la suppression.
  // => Pour ce lot, on s'appuie sur le 'CASCADE' ou on laisse purger 'auth.users' qui 
  // empêche de toute façon la reconnexion et la récupération des données.

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

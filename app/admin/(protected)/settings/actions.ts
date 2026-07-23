"use server"

import { createAdminClient, verifyAdminPermission } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function verifyAdmin(permission?: string) {
  const check = await verifyAdminPermission(permission)
  if (!check.authorized) return { error: "Non autorisé." as const }
  return { adminId: check.adminId }
}

async function logConfigAction(
  adminId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await createAdminClient()
    .from("admin_logs")
    .insert({ action, admin_id: adminId, target_user_id: adminId, details })
}

export async function togglePromoAction(
  newValue: boolean,
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin("users.write")
  if ("error" in auth) return { success: false, error: auth.error }

  const db = createAdminClient()
  const { error } = await db
    .from("app_config")
    .update({ value: String(newValue) })
    .eq("key", "promo_active")

  if (error) return { success: false, error: error.message }

  await logConfigAction(auth.adminId, "toggle_promo", { new_value: String(newValue) })
  revalidatePath("/admin/settings")
  return { success: true }
}

export async function setDisableAutoTrialAction(
  newValue: boolean,
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin("config.write")
  if ("error" in auth) return { success: false, error: auth.error }

  const db = createAdminClient()

  const { data: oldRow } = await db
    .from("app_config")
    .select("value")
    .eq("key", "disable_auto_trial")
    .maybeSingle()

  const { error } = await db
    .from("app_config")
    .update({ value: String(newValue) })
    .eq("key", "disable_auto_trial")

  if (error) return { success: false, error: error.message }

  await logConfigAction(auth.adminId, "toggle_disable_auto_trial", {
    old_value: oldRow?.value ?? "false",
    new_value: String(newValue),
  })
  revalidatePath("/admin/settings")
  return { success: true }
}

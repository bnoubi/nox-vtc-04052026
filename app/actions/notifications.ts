"use server"

import { createClient } from "@/lib/supabase/server"

export type NotifPrefs = {
  pushReservations: boolean
  pushPromotions: boolean
  emailRecap: boolean
  emailFactures: boolean
  smsConfirmation: boolean
  smsRappel: boolean
}

const DEFAULTS: NotifPrefs = {
  pushReservations: true,
  pushPromotions: false,
  emailRecap: true,
  emailFactures: true,
  smsConfirmation: false,
  smsRappel: false,
}

export async function getNotifPrefsAction(): Promise<NotifPrefs> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULTS

  const { data } = await supabase
    .from("notification_preferences")
    .select("push_reservations, push_promotions, email_recap, email_factures, sms_confirmation, sms_rappel")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!data) return DEFAULTS

  return {
    pushReservations: data.push_reservations,
    pushPromotions: data.push_promotions,
    emailRecap: data.email_recap,
    emailFactures: data.email_factures,
    smsConfirmation: data.sms_confirmation,
    smsRappel: data.sms_rappel,
  }
}

export async function saveNotifPrefsAction(prefs: NotifPrefs): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error: prefsError } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: user.id,
      push_reservations: prefs.pushReservations,
      push_promotions: prefs.pushPromotions,
      email_recap: prefs.emailRecap,
      email_factures: prefs.emailFactures,
      sms_confirmation: prefs.smsConfirmation,
      sms_rappel: prefs.smsRappel,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (prefsError) return { success: false }

  const { error: consentError } = await supabase
    .from("user_accounts")
    .update({ marketing_email_consent: prefs.pushPromotions })
    .eq("id", user.id)

  if (consentError) return { success: false }

  return { success: true }
}

import { createAdminClient, verifyAdminPermission } from "@/lib/supabase/admin"
import { getCouponPercent } from "@/lib/stripe/promo"
import { SettingsClient } from "./_client"

export default async function SettingsPage() {
  const db = createAdminClient()
  const { data } = await db
    .from("app_config")
    .select("key, value")
    .in("key", ["promo_active", "promo_coupon_id", "disable_auto_trial"])

  const find = (key: string) => data?.find(r => r.key === key)?.value ?? null

  const promoActive = find("promo_active") === "true"
  const promoCouponId = find("promo_coupon_id") ?? ""
  const disableAutoTrial = find("disable_auto_trial") === "true"

  let promoPercent = 0
  if (promoActive && promoCouponId) {
    promoPercent = (await getCouponPercent(promoCouponId)) ?? 0
  }

  const permCheck = await verifyAdminPermission("config.write")
  const canManageTrialFlag = permCheck.authorized

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--admin-foreground)" }}>
          Configuration
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--admin-muted-foreground)" }}>
          Paramètres globaux de la plateforme
        </p>
      </div>
      <SettingsClient
        promoActive={promoActive}
        promoPercent={promoPercent}
        promoCouponId={promoCouponId}
        disableAutoTrial={disableAutoTrial}
        canManageTrialFlag={canManageTrialFlag}
      />
    </div>
  )
}

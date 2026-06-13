"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Tag, Loader2 } from "lucide-react"

export default function SettingsPage() {
  const supabase = createClient()
  const [promoActive, setPromoActive] = useState(false)
  const [promoPercent, setPromoPercent] = useState(50)
  const [promoCouponId, setPromoCouponId] = useState("")
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["promo_active", "promo_percent", "promo_coupon_id"])
      .then(({ data, error }) => {
        if (error) console.error("settings app_config error:", error)
        if (data) {
          setPromoActive(data.find(c => c.key === "promo_active")?.value === "true")
          setPromoPercent(parseInt(data.find(c => c.key === "promo_percent")?.value ?? "50"))
          setPromoCouponId(data.find(c => c.key === "promo_coupon_id")?.value ?? "")
        }
        setLoading(false)
      })
  }, []) // eslint-disable-line

  async function togglePromo() {
    if (toggling) return
    setToggling(true)
    const newValue = !promoActive
    setPromoActive(newValue)
    const { error } = await supabase
      .from("app_config")
      .update({ value: newValue.toString() })
      .eq("key", "promo_active")
    if (error) {
      console.error("Erreur toggle promo:", error)
      setPromoActive(!newValue)
    }
    setToggling(false)
  }

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--admin-muted-foreground)" }} />
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          {/* Promo Toggle */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl border"
            style={{ background: "var(--admin-card)", borderColor: "var(--admin-border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--admin-accent)" }}>
                <Tag className="h-4 w-4" style={{ color: "var(--admin-accent-foreground)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--admin-foreground)" }}>
                  Promo lancement -{promoPercent}%
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--admin-muted-foreground)" }}>
                  {promoActive
                    ? `Active — coupon Stripe : ${promoCouponId || "(non configuré)"}`
                    : "Désactivée — les prix normaux s'affichent"}
                </p>
              </div>
            </div>
            <button
              onClick={togglePromo}
              disabled={toggling}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
                promoActive ? "bg-emerald-500" : "bg-gray-600",
                toggling && "opacity-60"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                promoActive ? "translate-x-6" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Info coupon */}
          {promoCouponId && (
            <div
              className="px-4 py-3 rounded-xl text-xs"
              style={{ background: "var(--admin-accent)", color: "var(--admin-muted-foreground)" }}
            >
              Coupon Stripe : <span className="font-mono font-semibold" style={{ color: "var(--admin-foreground)" }}>{promoCouponId}</span>
              {" · "}Applicable uniquement sur les abonnements Pro et Premium, premier mois uniquement.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

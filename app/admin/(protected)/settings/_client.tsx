"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Tag, UserX } from "lucide-react"
import { togglePromoAction, setDisableAutoTrialAction } from "./actions"

interface Props {
  promoActive: boolean
  promoPercent: number
  promoCouponId: string
  disableAutoTrial: boolean
  canManageTrialFlag: boolean
}

export function SettingsClient({
  promoActive: initPromo,
  promoPercent,
  promoCouponId,
  disableAutoTrial: initDisable,
  canManageTrialFlag,
}: Props) {
  const [promoActive, setPromoActive] = useState(initPromo)
  const [disableAutoTrial, setDisableAutoTrial] = useState(initDisable)
  const [togglingPromo, setTogglingPromo] = useState(false)
  const [togglingTrial, setTogglingTrial] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [trialError, setTrialError] = useState<string | null>(null)

  async function handleTogglePromo() {
    if (togglingPromo) return
    setTogglingPromo(true)
    setPromoError(null)
    const newValue = !promoActive
    setPromoActive(newValue)
    const result = await togglePromoAction(newValue)
    if (!result.success) {
      setPromoActive(!newValue)
      setPromoError(result.error ?? "Erreur inconnue")
    }
    setTogglingPromo(false)
  }

  async function handleToggleTrial() {
    if (togglingTrial) return
    setTogglingTrial(true)
    setTrialError(null)
    const newValue = !disableAutoTrial
    setDisableAutoTrial(newValue)
    const result = await setDisableAutoTrialAction(newValue)
    if (!result.success) {
      setDisableAutoTrial(!newValue)
      setTrialError(result.error ?? "Erreur inconnue")
    }
    setTogglingTrial(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Section Promotions */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-muted-foreground)" }}>
          Promotions
        </p>
        <div className="space-y-4">
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
              onClick={handleTogglePromo}
              disabled={togglingPromo}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
                promoActive ? "bg-emerald-500" : "bg-gray-600",
                togglingPromo && "opacity-60"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                promoActive ? "translate-x-6" : "translate-x-0.5"
              )} />
            </button>
          </div>
          {promoError && (
            <p className="text-xs text-red-400 px-1">{promoError}</p>
          )}
          {promoCouponId && (
            <div
              className="px-4 py-3 rounded-xl text-xs"
              style={{ background: "var(--admin-accent)", color: "var(--admin-muted-foreground)" }}
            >
              Coupon Stripe :{" "}
              <span className="font-mono font-semibold" style={{ color: "var(--admin-foreground)" }}>
                {promoCouponId}
              </span>
              {" · "}Applicable uniquement sur les abonnements Pro et Premium, premier mois uniquement.
            </div>
          )}
        </div>
      </div>

      {/* Section Inscriptions — visible uniquement si config.write */}
      {canManageTrialFlag && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-muted-foreground)" }}>
            Inscriptions
          </p>
          <div
            className="flex items-center justify-between p-4 rounded-2xl border"
            style={{ background: "var(--admin-card)", borderColor: "var(--admin-border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--admin-accent)" }}>
                <UserX className="h-4 w-4" style={{ color: "var(--admin-accent-foreground)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--admin-foreground)" }}>
                  Désactiver l&apos;essai automatique
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--admin-muted-foreground)" }}>
                  {disableAutoTrial
                    ? "Actif — les nouveaux inscrits démarrent en SOLO sans essai"
                    : "Inactif — les nouveaux inscrits reçoivent 14 jours d'essai TEAM"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleTrial}
              disabled={togglingTrial}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
                disableAutoTrial ? "bg-amber-500" : "bg-gray-600",
                togglingTrial && "opacity-60"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                disableAutoTrial ? "translate-x-6" : "translate-x-0.5"
              )} />
            </button>
          </div>
          {trialError && (
            <p className="text-xs text-red-400 px-1">{trialError}</p>
          )}
        </div>
      )}
    </div>
  )
}

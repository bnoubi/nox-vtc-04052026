"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { motion } from "framer-motion"
import { CheckCircle2 } from "lucide-react"

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()

  const type = params.get("type")
  const plan = params.get("plan")
  const validUntil = params.get("valid_until")
  const amount = params.get("amount")
  const before = params.get("before")
  const after = params.get("after")

  const isSubscription = type === "subscription"

  function formatDate(iso: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        <div className="bg-white border border-[#C5A059]/25 rounded-3xl shadow-[0_8px_48px_rgba(197,160,89,0.10)] px-8 py-10 flex flex-col items-center text-center">

          {/* Icon */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="mb-7 w-20 h-20 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center shadow-[0_0_32px_rgba(197,160,89,0.15)]"
          >
            <CheckCircle2 className="h-10 w-10 text-[#C5A059]" strokeWidth={1.75} />
          </motion.div>

          {isSubscription ? (
            <>
              <h1 className="text-2xl font-bold text-[#C5A059] tracking-tight mb-2">
                Bienvenue sur l'offre {plan} !
              </h1>
              <p className="text-[15px] text-[#1A1A1A]/70 mb-6 leading-relaxed">
                Merci pour votre confiance
              </p>
              {validUntil && (
                <div className="w-full bg-[#C5A059]/06 border border-[#C5A059]/20 rounded-2xl px-5 py-4 mb-8">
                  <p className="text-[13px] text-[#1A1A1A]/60 mb-1">Votre abonnement est actif jusqu'au</p>
                  <p className="text-[16px] font-semibold text-[#C5A059]">{formatDate(validUntil)}</p>
                </div>
              )}
              <button
                onClick={() => router.push("/")}
                className="w-full py-3.5 rounded-xl bg-[#C5A059] hover:bg-[#B08D46] active:scale-[0.98] transition-all text-white font-semibold text-[15px] tracking-wide shadow-[0_4px_20px_rgba(197,160,89,0.30)]"
              >
                Découvrir mon nouvel espace
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#C5A059] tracking-tight mb-2">
                Merci pour votre achat !
              </h1>
              <p className="text-[15px] text-[#1A1A1A]/70 mb-6 leading-relaxed">
                Vous avez acquis <span className="font-semibold text-[#1A1A1A]">{amount} jetons</span>
              </p>
              {before !== null && after !== null && (
                <div className="w-full bg-[#C5A059]/06 border border-[#C5A059]/20 rounded-2xl px-5 py-4 mb-8">
                  <p className="text-[13px] text-[#1A1A1A]/60 mb-2">Votre solde est passé de</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl font-bold text-[#1A1A1A]">{before}</span>
                    <span className="text-[#C5A059]/60 text-lg">→</span>
                    <span className="text-xl font-bold text-[#C5A059]">{after}</span>
                    <span className="text-[13px] text-[#1A1A1A]/50 font-medium">jetons</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => router.push("/")}
                className="w-full py-3.5 rounded-xl bg-[#C5A059] hover:bg-[#B08D46] active:scale-[0.98] transition-all text-white font-semibold text-[15px] tracking-wide shadow-[0_4px_20px_rgba(197,160,89,0.30)]"
              >
                Accéder à mon espace
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}

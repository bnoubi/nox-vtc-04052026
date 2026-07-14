"use client"

import { useState, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getTwoFactorStatusAction,
  requestTwoFactorCodeAction,
  verifyTwoFactorCodeAction,
} from "@/app/actions/two-factor"

function VerifyEmailCodeContent() {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  function startResendCooldown() {
    setResendCooldown(60)
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { enabled } = await getTwoFactorStatusAction()
      if (!enabled) {
        const next = searchParams.get('next') || '/'
        router.push(next)
        return
      }

      setIsSending(true)
      await requestTwoFactorCodeAction()
      setIsSending(false)
      startResendCooldown()
      setIsLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doVerify() {
    if (code.length !== 6) return
    setIsVerifying(true)
    setError(null)
    try {
      const result = await verifyTwoFactorCodeAction(code)
      if (!result.success) {
        setError(result.error ?? 'Code incorrect, veuillez réessayer.')
        setCode('')
        return
      }
      window.location.href = searchParams.get('next') || '/'
    } catch {
      setError('Erreur réseau, veuillez réessayer.')
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    await doVerify()
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setIsSending(true)
    setError(null)
    await requestTwoFactorCodeAction()
    setIsSending(false)
    startResendCooldown()
  }

  if (isLoading || isSending) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#D4AF37] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center">
          <span className="font-serif text-7xl leading-none" style={{ color: "#C9A84C" }}>N</span>
          <span className="mt-2 text-sm tracking-widest" style={{ color: "#8B6914" }}>NoX VTC</span>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-2">Vérification en 2 étapes</h2>
          <p className="text-[13px] text-[#888888] text-center leading-relaxed">
            Un code à 6 chiffres a été envoyé à votre adresse email. Il est valable 10 minutes.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            autoFocus
            className="w-full h-14 px-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-center font-mono placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
            style={{ fontSize: "22px", letterSpacing: "0.15em" }}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 space-y-2"
              >
                <p>{error}</p>
                {code.length === 6 && (
                  <button
                    type="button"
                    onClick={doVerify}
                    className="text-[11px] text-red-300 underline underline-offset-2 hover:text-red-200 transition-colors"
                  >
                    Réessayer
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isVerifying || code.length !== 6}
            className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Vérification...' : 'Vérifier'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isSending}
            className="w-full text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors py-2 disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default function VerifyEmailCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#D4AF37] animate-spin" />
        </div>
      }
    >
      <VerifyEmailCodeContent />
    </Suspense>
  )
}

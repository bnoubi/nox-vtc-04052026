"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function MfaVerifyPage() {
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.currentLevel === 'aal2') { router.push('/'); return }

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factor = factors?.totp.find(f => f.status === 'verified')
      if (!factor) { router.push('/'); return }

      setFactorId(factor.id)
      setIsLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setIsVerifying(true)
    setError(null)

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? 'Erreur de challenge, veuillez réessayer.')
      setIsVerifying(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyErr) {
      setError('Code incorrect, veuillez réessayer.')
      setCode('')
      setIsVerifying(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (isLoading) {
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
            <Shield className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-2">Vérification en 2 étapes</h2>
          <p className="text-[13px] text-[#888888] text-center leading-relaxed">
            Entrez le code à 6 chiffres généré par votre application d&apos;authentification.
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
            className="w-full h-14 px-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-center tracking-[0.3em] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
            style={{ fontSize: "22px" }}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400"
              >
                {error}
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
        </form>
      </motion.div>
    </div>
  )
}

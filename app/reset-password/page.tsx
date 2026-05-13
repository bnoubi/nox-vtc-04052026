"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isPasswordStrong, PasswordStrengthIndicator } from "@/app/register/page"
import { toast } from "sonner"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit = isPasswordStrong(password) && passwordsMatch

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!canSubmit) return

    setIsLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setIsLoading(false)

    if (error) {
      const errorMessage = error?.message || JSON.stringify(error)
      setError(`[DEBUG] ${errorMessage}`)
      return
    }

    toast.success("Mot de passe mis à jour. Vous pouvez vous connecter.")
    
    // Pour être sûr qu'on ne garde pas une session "recovery" sans s'être loggué proprement après coup :
    await supabase.auth.signOut() 
    
    setIsSuccess(true)
    setTimeout(() => {
      router.push("/login")
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-20 blur-3xl bg-[#D4AF37]/15 w-40 h-40 rounded-full" />
          <div className="relative w-full max-w-[220px]">
            <Image
              src="/assets/logo.png"
              alt="Logo NOX"
              width={220}
              height={110}
              priority
              className="w-full h-auto drop-shadow-[0_0_25px_rgba(212,175,55,0.35)]"
            />
          </div>
          <p className="mt-4 text-[14px] text-[#D4AF37] font-semibold tracking-wide uppercase">
            Nouveau mot de passe
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Mot de passe */}
          <div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border ${password && !isPasswordStrong(password) ? "border-red-500/50" : "border-[#D4AF37]/30"} text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors`}
                style={{ fontSize: "16px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                )}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} show={password.length > 0} />
          </div>

          {/* Confirmation mot de passe */}
          <div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="h-4 w-4 text-[#D4AF37]/30" strokeWidth={1.5} />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border ${confirmPassword && !passwordsMatch ? "border-red-500/50" : "border-[#D4AF37]/30"} text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors`}
                style={{ fontSize: "16px" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[10px] text-red-400 font-semibold ml-1 mt-1.5">Les mots de passe ne correspondent pas.</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !canSubmit || isSuccess}
            className="w-full h-14 mt-2 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSuccess ? "Redirection en cours..." : "Mettre à jour mon mot de passe"}
          </button>
        </motion.form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 tracking-wide leading-relaxed"
            >
              {error}
            </motion.div>
          )}

          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center text-[12px] text-emerald-400 tracking-wide leading-relaxed"
            >
              Votre mot de passe a été mis à jour avec succès.
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

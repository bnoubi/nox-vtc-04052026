"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      setError("Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré.")
      return
    }

    setSuccess(true)
    setTimeout(() => router.push("/"), 2500)
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />
        <div className="relative w-full max-w-sm px-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3 tracking-wide">Mot de passe mis à jour</h2>
          <p className="text-[13px] text-[#888888] leading-relaxed">
            Redirection vers votre dashboard...
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />

      {/* Content Container */}
      <div className="relative w-full max-w-sm px-6">

        {/* Logo Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="relative w-full max-w-[180px]">
            <Image
              src="/assets/logo.png"
              alt="Logo NOX"
              width={180}
              height={90}
              priority
              className="w-full h-auto drop-shadow-[0_0_25px_rgba(212,175,55,0.35)]"
            />
          </div>
          <p className="mt-3 text-[12px] text-[#D4AF37]/60 tracking-[0.2em] uppercase">Nouveau mot de passe</p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Nouveau mot de passe */}
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
              minLength={8}
              className="w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
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

          {/* Confirmation */}
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
              className="w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
          >
            Réinitialiser le mot de passe
          </button>
        </motion.form>

        {/* Error feedback */}
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
        </AnimatePresence>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex flex-col items-center"
        >
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-2 px-4"
          >
            Retour à la connexion
          </button>
        </motion.div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#000000]/95 backdrop-blur-sm"
          >
            <div className="relative w-12 h-12 mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#D4AF37] animate-spin" />
            </div>
            <p className="text-[13px] text-[#D4AF37]/90 font-light tracking-wide">
              Mise à jour en cours...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative bottom line */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
    </motion.div>
  )
}

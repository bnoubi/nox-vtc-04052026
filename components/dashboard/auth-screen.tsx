"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"

interface AuthScreenProps {
  onAuthenticated: () => void
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    initiateAuth()
  }

  function handleSocialLogin(provider: "google" | "apple") {
    console.log(`[v0] Social login with ${provider}`)
    initiateAuth()
  }

  function initiateAuth() {
    setIsLoading(true)
    // Simulate authentication delay
    setTimeout(() => {
      onAuthenticated()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[#000000] px-6">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />

      {/* Logo Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mb-12 flex flex-col items-center"
      >
        {/* Gold glow behind logo */}
        <div className="absolute inset-0 blur-3xl bg-[#D4AF37]/20 rounded-full scale-150" />
        
        <h1 className="relative text-4xl font-bold tracking-tight text-center">
          <span className="bg-gradient-to-b from-[#F5E6C8] via-[#D4AF37] to-[#B8962E] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            NOX
          </span>
          <span className="mx-2 text-[#D4AF37]/60">-</span>
          <span className="bg-gradient-to-b from-[#F5E6C8] via-[#D4AF37] to-[#B8962E] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            VTC
          </span>
        </h1>
        <p className="mt-3 text-[11px] tracking-[0.25em] uppercase text-[#D4AF37]/50">
          Espace Chauffeur
        </p>
      </motion.div>

      {/* Login Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        onSubmit={handleLogin}
        className="relative w-full max-w-sm space-y-4"
      >
        {/* Email Field */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Mail className="h-4 w-4 text-[#D4AF37]/60" strokeWidth={1.5} />
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-sm placeholder:text-[#666666] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all"
          />
        </div>

        {/* Password Field */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Lock className="h-4 w-4 text-[#D4AF37]/60" strokeWidth={1.5} />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-sm placeholder:text-[#666666] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-[#666666]" strokeWidth={1.5} />
            ) : (
              <Eye className="h-4 w-4 text-[#666666]" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          className="w-full h-12 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-sm font-bold tracking-wide uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20"
        >
          Se connecter
        </button>
      </motion.form>

      {/* Social Login Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative w-full max-w-sm my-8 flex items-center gap-4"
      >
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333333] to-transparent" />
        <span className="text-[11px] tracking-wider uppercase text-[#555555]">
          ou continuer avec
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333333] to-transparent" />
      </motion.div>

      {/* Social Login Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="flex items-center justify-center gap-6"
      >
        {/* Google */}
        <button
          type="button"
          onClick={() => handleSocialLogin("google")}
          className="w-14 h-14 rounded-full border border-[#D4AF37]/40 bg-[#0A0A0A] flex items-center justify-center hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/5 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#F5F5F5"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#F5F5F5"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#F5F5F5"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#F5F5F5"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </button>

        {/* Apple */}
        <button
          type="button"
          onClick={() => handleSocialLogin("apple")}
          className="w-14 h-14 rounded-full border border-[#D4AF37]/40 bg-[#0A0A0A] flex items-center justify-center hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/5 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#F5F5F5">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </button>
      </motion.div>

      {/* Footer Links */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="absolute bottom-10 flex flex-col items-center gap-4"
      >
        <button
          type="button"
          className="text-[12px] text-[#666666] hover:text-[#D4AF37]/80 transition-colors"
        >
          Mot de passe oublié ?
        </button>
        <button
          type="button"
          className="text-[12px] text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors font-medium"
        >
          Devenir Membre
        </button>
      </motion.div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            {/* Spinner */}
            <div className="relative w-16 h-16 mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#D4AF37] border-r-[#D4AF37]/30"
              />
              <div className="absolute inset-2 rounded-full border border-[#D4AF37]/20" />
            </div>
            <p className="text-[13px] text-[#D4AF37]/90 font-light tracking-wide">
              Vérification de l&apos;identité NoX en cours...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

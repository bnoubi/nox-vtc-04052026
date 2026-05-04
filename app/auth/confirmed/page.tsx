"use client"

import { motion } from "framer-motion"
import { CheckCircle2, ArrowRight } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function EmailConfirmedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.04)_0%,transparent_70%)] pointer-events-none" />

      {/* Subtle animated glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#D4AF37]/5 blur-3xl pointer-events-none"
      />

      <div className="relative w-full max-w-sm px-6 flex flex-col items-center text-center">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-10"
        >
          <div className="relative w-full max-w-[180px] mx-auto">
            <Image
              src="/assets/logo.png"
              alt="Logo NOX"
              width={180}
              height={90}
              priority
              className="w-full h-auto drop-shadow-[0_0_25px_rgba(212,175,55,0.35)]"
            />
          </div>
        </motion.div>

        {/* Success Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200 }}
          className="mb-6"
        >
          <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="text-[20px] font-semibold text-[#F5F5F5] mb-3 tracking-wide"
        >
          Email confirmé avec succès
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="text-[13px] text-[#888888] leading-relaxed mb-10 max-w-[280px]"
        >
          Votre adresse email a été vérifiée. Vous pouvez maintenant vous connecter à votre espace NoX.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
          onClick={() => router.push("/login")}
          className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2"
        >
          Se connecter
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </motion.button>

        {/* Security footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-8 flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
          <span className="text-[10px] text-[#555555] tracking-wider uppercase">Compte vérifié et sécurisé</span>
        </motion.div>
      </div>

      {/* Decorative bottom line */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
    </div>
  )
}

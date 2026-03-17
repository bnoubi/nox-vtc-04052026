"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

const SLOGANS = [
  "La conformité VTC sans compromis.",
  "Le Guardian NOX veille sur votre activité VTC en temps réel.",
  "L'excellence de la gestion VTC.",
]

interface WelcomeComponentProps {
  onFinished: () => void
}

export function WelcomeComponent({ onFinished }: WelcomeComponentProps) {
  const [phase, setPhase] = useState<"logo" | "slogans" | "button">("logo")
  const [currentSlogan, setCurrentSlogan] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const logoTimer = setTimeout(() => {
      setPhase("slogans")
    }, 1200)
    return () => clearTimeout(logoTimer)
  }, [])

  useEffect(() => {
    if (phase !== "slogans") return

    if (currentSlogan < SLOGANS.length - 1) {
      const sloganTimer = setTimeout(() => {
        setCurrentSlogan((prev) => prev + 1)
      }, 1800)
      return () => clearTimeout(sloganTimer)
    } else {
      const buttonTimer = setTimeout(() => {
        setPhase("button")
      }, 1800)
      return () => clearTimeout(buttonTimer)
    }
  }, [phase, currentSlogan])

  function handleEnter() {
    setIsExiting(true)
    setTimeout(() => {
      onFinished()
    }, 600)
  }

  return (
    <AnimatePresence>
      {!isExiting ? (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative mb-12 flex flex-col items-center"
          >
            <div className="absolute inset-0 blur-3xl bg-[#D4AF37]/20 rounded-full scale-150" />
            <div className="relative w-full max-w-[280px]">
              <Image
                src="/assets/logo.png"
                alt="Logo NOX"
                width={280}
                height={140}
                priority
                className="w-full h-auto drop-shadow-[0_0_30px_rgba(212,175,55,0.4)]"
              />
            </div>
          </motion.div>

          {/* Slogans */}
          <div className="h-16 flex items-center justify-center px-8">
            <AnimatePresence mode="wait">
              {phase === "slogans" && (
                <motion.p
                  key={currentSlogan}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="text-center text-[15px] font-light tracking-wide text-[#D4AF37]/90 max-w-xs leading-relaxed"
                >
                  {SLOGANS[currentSlogan]}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Enter Button */}
          <div className="h-20 mt-8">
            <AnimatePresence>
              {phase === "button" && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  onClick={handleEnter}
                  className="group relative px-8 py-3.5 rounded-full border border-[#D4AF37]/60 bg-transparent overflow-hidden active:scale-[0.97] transition-transform"
                >
                  <div className="absolute inset-0 bg-[#D4AF37]/0 group-hover:bg-[#D4AF37]/10 transition-colors duration-300" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />
                  </div>
                  <span className="relative text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F5F5F5]">
                    Entrer dans l&apos;univers NOX
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent"
          />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] bg-[#000000]"
        />
      )}
    </AnimatePresence>
  )
}

"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"

interface WelcomeComponentProps {
  onFinished: () => void
}

export function WelcomeComponent({ onFinished }: WelcomeComponentProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished()
    }, 1500)
    return () => clearTimeout(timer)
  }, [onFinished])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]"
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="font-serif text-8xl"
        style={{ color: "#C9A84C" }}
      >
        N
      </motion.span>
    </motion.div>
  )
}

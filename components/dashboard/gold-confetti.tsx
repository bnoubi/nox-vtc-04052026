"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Particle {
  id: number
  x: number
  delay: number
  duration: number
  size: number
  opacity: number
  rotation: number
}

export function GoldConfetti({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!trigger) return

    const newParticles: Particle[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.5 + Math.random() * 1.5,
      size: 4 + Math.random() * 8,
      opacity: 0.4 + Math.random() * 0.6,
      rotation: Math.random() * 360,
    }))

    setParticles(newParticles)

    const timer = setTimeout(() => setParticles([]), 3500)
    return () => clearTimeout(timer)
  }, [trigger])

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                opacity: 0,
                y: -20,
                x: `${p.x}vw`,
                rotate: 0,
                scale: 0,
              }}
              animate={{
                opacity: [0, p.opacity, p.opacity, 0],
                y: ["0vh", "100vh"],
                rotate: p.rotation + 360,
                scale: [0, 1, 1, 0.5],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeIn",
              }}
              className="absolute top-0"
              style={{ left: `${p.x}%` }}
            >
              <div
                className="rounded-sm"
                style={{
                  width: p.size,
                  height: p.size * 0.6,
                  background:
                    p.id % 3 === 0
                      ? "linear-gradient(135deg, #C5A059, #E8D5A3)"
                      : p.id % 3 === 1
                        ? "#C5A059"
                        : "linear-gradient(135deg, #A88942, #C5A059)",
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}

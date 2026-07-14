"use client"

import { Shield } from "lucide-react"

export function SecurityBadge() {
  return (
    <div className="fixed bottom-24 left-4 z-40">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-onyx-card/80 border border-gold/10 backdrop-blur-sm">
        <Shield className="h-3.5 w-3.5 text-gold/70" strokeWidth={1.5} />
        <span className="text-[9px] text-gold/70 font-medium tracking-wide">
          Connexion sécurisée (TLS)
        </span>
      </div>
    </div>
  )
}

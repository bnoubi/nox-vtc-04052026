"use client"

import { useEffect } from "react"

export function CapacitorDeepLink() {
  useEffect(() => {
    function handleAppUrlOpen(event: Event) {
      const url: string | undefined = (event as CustomEvent<{ url: string }>).detail?.url
      if (!url) return
      try {
        const parsed = new URL(url)
        if (parsed.pathname.startsWith('/auth/callback')) {
          window.location.replace(url)
        }
      } catch {
        // URL invalide, on ignore
      }
    }
    window.addEventListener('appUrlOpen', handleAppUrlOpen)
    return () => window.removeEventListener('appUrlOpen', handleAppUrlOpen)
  }, [])
  return null
}

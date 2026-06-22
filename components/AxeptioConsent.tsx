"use client"

import { useEffect } from "react"

type AxeptioSDK = {
  on: (event: string, callback: (choices: Record<string, boolean>) => void) => void
}

type AxeptioWindow = Window & {
  _axcb?: Array<(axeptio: AxeptioSDK) => void>
  dataLayer?: unknown[]
}

export function AxeptioConsent() {
  useEffect(() => {
    const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (!GA_ID || GA_ID === "G-XXXXXXXXXX") return

    const w = window as AxeptioWindow
    let gaInjected = false

    const injectGA = () => {
      if (gaInjected) return
      gaInjected = true
      w.dataLayer = w.dataLayer || []
      const gtag = (...args: unknown[]) => { w.dataLayer!.push(args) }
      gtag("js", new Date())
      gtag("config", GA_ID, { anonymize_ip: true })
      const s = document.createElement("script")
      s.async = true
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
      document.head.appendChild(s)
    }

    const disableGA = () => {
      ;(w as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true
    }

    w._axcb = w._axcb || []
    w._axcb.push((axeptio) => {
      axeptio.on("cookies:complete", (choices) => {
        if (choices?.ga_analytics) {
          injectGA()
        } else {
          disableGA()
        }
      })
    })
  }, [])

  return null
}

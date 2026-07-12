"use client"

import dynamic from "next/dynamic"

// Import dynamique côté client uniquement — évite que le bundle React SSR
// (Next.js 16 / React 19) appelle useEffect/window pendant le rendu serveur.
const AuthScreenDynamic = dynamic(
  () => import("@/components/AuthScreen").then((m) => ({ default: m.AuthScreen })),
  { ssr: false }
)

export function AuthScreenClient({ initialError }: { initialError?: string }) {
  return <AuthScreenDynamic initialError={initialError} />
}

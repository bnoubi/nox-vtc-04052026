"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type Plan = "PRO" | "GOLD"

interface PlanContextValue {
  plan: Plan
  upgrade: () => void
}

const PlanContext = createContext<PlanContextValue>({
  plan: "PRO",
  upgrade: () => {},
})

export function usePlan() {
  return useContext(PlanContext)
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan>("PRO")

  const upgrade = useCallback(() => {
    setPlan("GOLD")
  }, [])

  return (
    <PlanContext.Provider value={{ plan, upgrade }}>
      {children}
    </PlanContext.Provider>
  )
}

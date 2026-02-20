"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type Plan = "SOLO" | "PRO" | "GOLD"

export const PLAN_LIMITS: Record<Plan, { drivers: number; vehicles: number }> = {
  SOLO: { drivers: 1, vehicles: 1 },
  PRO: { drivers: 2, vehicles: 2 },
  GOLD: { drivers: 10, vehicles: 10 },
}

interface PlanContextValue {
  plan: Plan
  driverCount: number
  vehicleCount: number
  tokens: number
  setDriverCount: (n: number) => void
  setVehicleCount: (n: number) => void
  upgrade: (target?: Plan) => void
}

const PlanContext = createContext<PlanContextValue>({
  plan: "SOLO",
  driverCount: 0,
  vehicleCount: 0,
  tokens: 0,
  setDriverCount: () => {},
  setVehicleCount: () => {},
  upgrade: () => {},
})

export function usePlan() {
  return useContext(PlanContext)
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan>("SOLO")
  const [driverCount, setDriverCount] = useState(0)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [tokens, setTokens] = useState(0)

  const upgrade = useCallback((target?: Plan) => {
    if (target) {
      setPlan(target)
    } else {
      setPlan((prev) => (prev === "SOLO" ? "PRO" : "GOLD"))
    }
  }, [])

  return (
    <PlanContext.Provider value={{ plan, driverCount, vehicleCount, tokens, setDriverCount, setVehicleCount, upgrade }}>
      {children}
    </PlanContext.Provider>
  )
}

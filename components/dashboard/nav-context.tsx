"use client"

import { createContext, useContext, useCallback, useRef, useState } from "react"
import type { TabId } from "./bottom-nav"

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "enterprise" | "subscription" | "plans" | "notifications" | "security" | "cgv" | "wallet_history"

export interface EntityNavigation {
  entityType: "driver" | "vehicle" | "enterprise"
  entityId: string
  field: string
}

interface NavContextValue {
  switchTab: (tab: TabId) => void
  navigateToSubscription: () => void
  navigateToCGV: () => void
  registerSettingsNavigator: (fn: (screen: SettingsScreen) => void) => void
  openWallet: () => void
  registerWalletOpener: (fn: () => void) => void
  logout: () => void
  navigateToEntity: (entityType: "driver" | "vehicle" | "enterprise", entityId: string, field: string) => void
  pendingEntityNavigation: EntityNavigation | null
  clearPendingEntityNavigation: () => void
  pendingBcId: string | null
  navigateToBC: (id: string) => void
  clearPendingBcId: () => void
  navigateToWalletHistory: () => void
  navigateToRecurring: () => void
  pendingRecurring: boolean
  clearPendingRecurring: () => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({
  children,
  onTabChange,
  onLogout,
}: {
  children: React.ReactNode
  onTabChange: (tab: TabId) => void
  onLogout?: () => void
}) {
  const settingsNavigatorRef = useRef<((screen: SettingsScreen) => void) | null>(null)
  const walletOpenerRef = useRef<(() => void) | null>(null)
  const [pendingEntityNavigation, setPendingEntityNavigation] = useState<EntityNavigation | null>(null)
  const [pendingBcId, setPendingBcId] = useState<string | null>(null)
  const [pendingRecurring, setPendingRecurring] = useState(false)

  const registerSettingsNavigator = useCallback((fn: (screen: SettingsScreen) => void) => {
    settingsNavigatorRef.current = fn
  }, [])

  const registerWalletOpener = useCallback((fn: () => void) => {
    walletOpenerRef.current = fn
  }, [])

  const openWallet = useCallback(() => {
    walletOpenerRef.current?.()
  }, [])

  const logout = useCallback(() => {
    onLogout?.()
  }, [onLogout])

  const switchTab = useCallback((tab: TabId) => {
    onTabChange(tab)
  }, [onTabChange])

  const navigateToSubscription = useCallback(() => {
    onTabChange("settings")
    // Small delay so the settings tab mounts before we navigate internally
    setTimeout(() => {
      settingsNavigatorRef.current?.("subscription")
    }, 50)
  }, [onTabChange])

  const navigateToCGV = useCallback(() => {
    onTabChange("settings")
    setTimeout(() => {
      settingsNavigatorRef.current?.("cgv")
    }, 50)
  }, [onTabChange])

  const navigateToEntity = useCallback((entityType: "driver" | "vehicle" | "enterprise", entityId: string, field: string) => {
    setPendingEntityNavigation({ entityType, entityId, field })
    onTabChange("settings")
    // SettingsTab reads pendingEntityNavigation on mount and navigates to the correct sub-screen
  }, [onTabChange])

  const clearPendingEntityNavigation = useCallback(() => {
    setPendingEntityNavigation(null)
  }, [])

  const navigateToBC = useCallback((id: string) => {
    setPendingBcId(id)
  }, [])

  const navigateToWalletHistory = useCallback(() => {
    onTabChange("settings")
    setTimeout(() => {
      settingsNavigatorRef.current?.("wallet_history")
    }, 150)
  }, [onTabChange])

  const navigateToRecurring = useCallback(() => {
    setPendingRecurring(true)
    onTabChange("documents")
  }, [onTabChange])

  const clearPendingRecurring = useCallback(() => {
    setPendingRecurring(false)
  }, [])

  const clearPendingBcId = useCallback(() => {
    setPendingBcId(null)
  }, [])

  return (
    <NavContext.Provider value={{
      switchTab,
      navigateToSubscription,
      navigateToCGV,
      registerSettingsNavigator,
      openWallet,
      registerWalletOpener,
      logout,
      navigateToEntity,
      pendingEntityNavigation,
      clearPendingEntityNavigation,
      pendingBcId,
      navigateToBC,
      clearPendingBcId,
      navigateToWalletHistory,
      navigateToRecurring,
      pendingRecurring,
      clearPendingRecurring,
    }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error("useNav must be used within NavProvider")
  return ctx
}

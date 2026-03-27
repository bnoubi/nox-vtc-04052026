"use client"

import { createContext, useContext, useCallback, useRef, useState } from "react"
import type { TabId } from "./bottom-nav"

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "enterprise" | "banking" | "subscription" | "notifications" | "security"

export interface EntityNavigation {
  entityType: "driver" | "vehicle"
  entityId: string
  field: string
}

interface NavContextValue {
  switchTab: (tab: TabId) => void
  navigateToSubscription: () => void
  registerSettingsNavigator: (fn: (screen: SettingsScreen) => void) => void
  openWallet: () => void
  registerWalletOpener: (fn: () => void) => void
  logout: () => void
  navigateToEntity: (entityType: "driver" | "vehicle", entityId: string, field: string) => void
  pendingEntityNavigation: EntityNavigation | null
  clearPendingEntityNavigation: () => void
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

  const navigateToEntity = useCallback((entityType: "driver" | "vehicle", entityId: string, field: string) => {
    // Store the pending navigation
    setPendingEntityNavigation({ entityType, entityId, field })
    // Switch to settings tab
    onTabChange("settings")
    // Navigate to the correct settings screen
    setTimeout(() => {
      if (entityType === "driver") {
        settingsNavigatorRef.current?.("team")
      } else {
        settingsNavigatorRef.current?.("fleet")
      }
    }, 50)
  }, [onTabChange])

  const clearPendingEntityNavigation = useCallback(() => {
    setPendingEntityNavigation(null)
  }, [])

  return (
    <NavContext.Provider value={{ 
      switchTab, 
      navigateToSubscription, 
      registerSettingsNavigator, 
      openWallet, 
      registerWalletOpener, 
      logout,
      navigateToEntity,
      pendingEntityNavigation,
      clearPendingEntityNavigation
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

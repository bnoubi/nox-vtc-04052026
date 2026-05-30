"use client"

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js"

type ItemType =
  | "pack_decouverte"
  | "pack_privilege"
  | "pack_prestige"
  | "plan_duo"
  | "plan_team"

interface PayPalCheckoutButtonProps {
  itemType: ItemType
  userId: string
  onError: () => void
}

export function PayPalCheckoutButton({ itemType, userId, onError }: PayPalCheckoutButtonProps) {
  return (
    <PayPalScriptProvider
      options={{
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "",
        currency:  "EUR",
        intent:    "capture",
      }}
    >
      <PayPalButtons
        style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 45 }}
        createOrder={async () => {
          const res = await fetch("/api/paypal/create-order", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ itemType, userId }),
          })
          const data = (await res.json()) as { orderID?: string; error?: string }
          if (!res.ok || !data.orderID) throw new Error(data.error ?? "Erreur création commande")
          return data.orderID
        }}
        onApprove={async (data) => {
          const res = await fetch("/api/paypal/capture-order", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ orderID: data.orderID, itemType, userId }),
          })
          const result = (await res.json()) as {
            success?: boolean
            redirectUrl?: string
            error?: string
          }
          if (!res.ok || !result.success) throw new Error(result.error ?? "Erreur capture")
          window.location.href = result.redirectUrl ?? "/payment/success"
        }}
        onError={onError}
      />
    </PayPalScriptProvider>
  )
}

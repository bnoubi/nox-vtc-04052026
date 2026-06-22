import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import { headers } from 'next/headers'

import './globals.css'
import { AxeptioConsent } from '@/components/AxeptioConsent'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'NoX VTC | Luxury Chauffeur Dashboard',
  description: 'Professional VTC management platform for luxury chauffeur services',
  generator: 'v0.app',
  icons: {
    icon: '/assets/icon.png',
    shortcut: '/assets/icon.png',
    apple: '/assets/icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0F0F0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return (
    <html lang="en" nonce={nonce} className={`${inter.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.axeptioSettings = {
                clientId: "6a38caef6f0c0b69da2fc608",
                cookiesVersion: "appnoxvtc-fr",
              };
              (function(d, s) {
                var t = d.getElementsByTagName(s)[0], e = d.createElement(s);
                e.async = true;
                e.src = "//static.axept.io/sdk.js";
                t.parentNode.insertBefore(e, t);
              })(document, "script");
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AxeptioConsent />
        {children}
      </body>
    </html>
  )
}

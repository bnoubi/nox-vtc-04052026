"use client"

import Link from "next/link"

type Cookie = {
  name: string
  provider: string
  purpose: string
  duration: string
}

const NECESSARY_COOKIES: Cookie[] = [
  {
    name: "sb-*",
    provider: "Supabase",
    purpose: "Session d'authentification sécurisée",
    duration: "Session",
  },
  {
    name: "sidebar:state",
    provider: "NoX VTC",
    purpose: "Mémorisation de l'état de la barre latérale",
    duration: "1 an",
  },
]

const ANALYTICS_COOKIES: Cookie[] = [
  {
    name: "_ga",
    provider: "Google Analytics 4",
    purpose: "Identification d'un visiteur unique",
    duration: "2 ans",
  },
  {
    name: "_gid",
    provider: "Google Analytics 4",
    purpose: "Distinction des sessions de navigation",
    duration: "24 heures",
  },
]

const CONSENT_COOKIES: Cookie[] = [
  {
    name: "axeptio_cookies",
    provider: "Axeptio",
    purpose: "Mémorisation de vos préférences de consentement",
    duration: "13 mois",
  },
  {
    name: "axeptio_authorized_vendors",
    provider: "Axeptio",
    purpose: "Liste des fournisseurs autorisés",
    duration: "13 mois",
  },
]

export default function PolitiqueDeCookiesPage() {
  const openAxeptio = () => {
    if (
      typeof window !== "undefined" &&
      typeof (window as Window & { openAxeptioCookies?: () => void })
        .openAxeptioCookies === "function"
    ) {
      ;(
        window as Window & { openAxeptioCookies?: () => void }
      ).openAxeptioCookies!()
    }
  }

  return (
    <div className="min-h-screen bg-onyx text-foreground">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.04)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-widest hover:text-gold transition-colors mb-10"
          >
            ← Retour
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-8 rounded-full bg-gold" />
            <p className="text-[11px] text-gold uppercase tracking-widest">Consentement</p>
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-2">
            Politique de cookies
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Version en vigueur au 24 juin 2026 — SABITOU SOLUTIONS &amp; SERVICES
          </p>
        </div>

        <div className="space-y-6">
          <section className="p-6 rounded-2xl bg-onyx-card border border-onyx-border text-[13px] text-muted-foreground leading-relaxed">
            <p>
              Le site <strong className="text-foreground">app.noxvtc.fr</strong> utilise
              des cookies et technologies similaires. Cette page vous informe sur leur
              nature, leur finalité et les moyens de gérer vos préférences,
              conformément au RGPD et aux recommandations de la CNIL.
            </p>
          </section>

          <Section title="Cookies strictement nécessaires" badge="Pas de consentement requis">
            <p className="mb-4">
              Ces cookies sont indispensables au fonctionnement du Service. Ils ne
              peuvent pas être désactivés.
            </p>
            <CookieTable cookies={NECESSARY_COOKIES} />
          </Section>

          <Section title="Cookies analytiques" badge="Consentement requis">
            <p className="mb-4">
              Ces cookies nous permettent d'analyser l'usage du Service afin de
              l'améliorer. Ils ne sont déposés qu'après votre consentement explicite
              via le widget Axeptio.
            </p>
            <CookieTable cookies={ANALYTICS_COOKIES} />
          </Section>

          <Section title="Cookies de gestion du consentement" badge="Nécessaire (CMP)">
            <p className="mb-4">
              Ces cookies mémorisent vos choix effectués via le widget Axeptio (CMP —
              Consent Management Platform). Ils sont requis pour respecter et
              enregistrer vos préférences.
            </p>
            <CookieTable cookies={CONSENT_COOKIES} />
          </Section>

          <section className="p-6 rounded-2xl bg-onyx-card border border-gold/20">
            <h2 className="text-[15px] font-semibold font-heading text-gold mb-3">
              Gérer vos préférences
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              Vous pouvez modifier vos choix de consentement à tout moment. Vos
              préférences seront mémorisées pendant 13 mois.
            </p>
            <button
              onClick={openAxeptio}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-primary-foreground text-[13px] font-semibold hover:bg-gold-light active:scale-[0.98] transition-all"
            >
              Gérer mes cookies
            </button>
          </section>

          <section className="p-6 rounded-2xl bg-onyx-card border border-onyx-border text-[13px] text-muted-foreground leading-relaxed">
            <h2 className="text-[15px] font-semibold font-heading text-foreground mb-3">
              Contact
            </h2>
            <p>
              Pour toute question relative à notre utilisation des cookies ou à la
              protection de vos données :
            </p>
            <p className="mt-2">
              Email :{" "}
              <a
                href="mailto:support@noxvtc.fr"
                className="text-gold hover:underline"
              >
                support@noxvtc.fr
              </a>
            </p>
            <p className="mt-1">
              SABITOU SOLUTIONS &amp; SERVICES — 9 Rue de Charnesseuil, 77750
              Saint-Cyr-Sur-Morin
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-onyx-border flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
          <Link
            href="/politique-de-confidentialite"
            className="hover:text-gold transition-colors"
          >
            Politique de confidentialité
          </Link>
          <span>·</span>
          <a
            href="mailto:support@noxvtc.fr"
            className="hover:text-gold transition-colors"
          >
            support@noxvtc.fr
          </a>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge: string
  children: React.ReactNode
}) {
  return (
    <section className="p-6 rounded-2xl bg-onyx-card border border-onyx-border">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-[15px] font-semibold font-heading text-gold">{title}</h2>
        <span className="text-[10px] text-muted-foreground border border-onyx-border rounded-full px-2 py-0.5 leading-none">
          {badge}
        </span>
      </div>
      <div className="text-[13px] text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

function CookieTable({ cookies }: { cookies: Cookie[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-muted-foreground uppercase tracking-wider text-[10px]">
            <th className="pb-2 pr-4 font-medium">Cookie</th>
            <th className="pb-2 pr-4 font-medium">Fournisseur</th>
            <th className="pb-2 pr-4 font-medium">Finalité</th>
            <th className="pb-2 font-medium whitespace-nowrap">Durée</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-onyx-border">
          {cookies.map((c) => (
            <tr key={c.name}>
              <td className="py-3 pr-4 font-mono text-gold">{c.name}</td>
              <td className="py-3 pr-4 text-muted-foreground">{c.provider}</td>
              <td className="py-3 pr-4 text-muted-foreground">{c.purpose}</td>
              <td className="py-3 text-foreground whitespace-nowrap">{c.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

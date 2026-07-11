import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Politique de confidentialité | NoX VTC",
  description:
    "Politique de protection des données personnelles de NoX VTC (SABITOU SOLUTIONS & SERVICES) — conformité RGPD.",
}

export default function PolitiqueDeConfidentialitePage() {
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
            <p className="text-[11px] text-gold uppercase tracking-widest">RGPD</p>
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-2">
            Politique de confidentialité
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Version en vigueur au 24 juin 2026 — SABITOU SOLUTIONS &amp; SERVICES
          </p>
        </div>

        <div className="space-y-6">
          <Section title="1. Responsable du traitement">
            <p>
              Le traitement des données personnelles collectées dans le cadre de
              l'utilisation du Service NoX VTC est assuré par :
            </p>
            <div className="mt-4 p-4 rounded-xl bg-onyx-card border border-onyx-border space-y-1">
              <p className="font-semibold text-foreground">SABITOU SOLUTIONS &amp; SERVICES</p>
              <p>Société par Actions Simplifiée Unipersonnelle (SASU)</p>
              <p>9 Rue de Charnesseuil, 77750 Saint-Cyr-Sur-Morin, France</p>
              <p>
                Email :{" "}
                <a href="mailto:support@noxvtc.fr" className="text-gold hover:underline">
                  support@noxvtc.fr
                </a>
              </p>
            </div>
          </Section>

          <Section title="2. Délégué à la Protection des Données (DPO)">
            <p>
              Conformément à l'article 37 du RGPD, la désignation d'un Délégué à la
              Protection des Données n'est pas obligatoire pour SABITOU SOLUTIONS &amp;
              SERVICES. En effet, le Service NoX VTC ne procède pas à un suivi régulier
              et systématique de personnes à grande échelle, ne traite pas de données
              sensibles au sens de l'article 9 du RGPD, et ne constitue pas une
              plateforme de géolocalisation en temps réel ou de mise en relation.
            </p>
            <p className="mt-3">
              Pour toute question relative à la protection des données :{" "}
              <a href="mailto:support@noxvtc.fr" className="text-gold hover:underline">
                support@noxvtc.fr
              </a>
            </p>
          </Section>

          <Section title="3. Données collectées">
            <p>
              Dans le cadre du Service, les catégories de données suivantes sont
              collectées :
            </p>
            <ul className="mt-3 space-y-2">
              {[
                "Identification professionnelle : nom, prénom, adresse email",
                "Identifiants professionnels : numéro SIREN, numéro de carte professionnelle VTC",
                "Informations relatives au véhicule",
                "Données d'activité : bons de commande, factures, trajets",
                "Données de connexion : horodatage des sessions",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="4. Finalités et bases légales du traitement">
            <div className="divide-y divide-onyx-border">
              <Row
                label="Fourniture du Service, gestion de l'abonnement"
                value="Exécution du contrat"
              />
              <Row
                label="Facturation et gestion des paiements"
                value="Exécution du contrat / obligation légale"
              />
              <Row label="Support client" value="Intérêt légitime" />
              <Row
                label="Analyse d'audience (Google Analytics 4)"
                value="Consentement explicite"
              />
            </div>
          </Section>

          <Section title="5. Hébergement et transfert des données">
            <p>
              Les données sont hébergées par{" "}
              <strong className="text-foreground">Supabase</strong>, dont
              l'infrastructure repose sur Amazon Web Services (AWS). Des serveurs
              peuvent être situés hors de l'Union Européenne, notamment aux
              États-Unis. Ce transfert est encadré par les{" "}
              <strong className="text-foreground">
                Clauses Contractuelles Types (CCT)
              </strong>{" "}
              approuvées par la Commission Européenne, conformément au RGPD.
            </p>
          </Section>

          <Section title="6. Vos droits (RGPD)">
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="mt-3 space-y-2">
              {[
                "Droit d'accès à vos données personnelles",
                "Droit de rectification des données inexactes",
                "Droit à l'effacement (droit à l'oubli)",
                "Droit à la portabilité de vos données",
                "Droit d'opposition au traitement",
              ].map((r) => (
                <li key={r} className="flex items-start gap-2.5">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Ces droits peuvent être exercés depuis votre espace personnel ou par
              email à{" "}
              <a href="mailto:support@noxvtc.fr" className="text-gold hover:underline">
                support@noxvtc.fr
              </a>
              . En cas de litige, vous pouvez saisir la{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                CNIL
              </a>
              .
            </p>
          </Section>

          <Section title="7. Données clients de l'abonné — rôle de sous-traitant">
            <p>
              L'abonné peut enregistrer dans le Service des données personnelles
              relatives à ses propres clients (nom, prénom, coordonnées
              téléphoniques, adresse, historique de trajets). Pour ces données :
            </p>
            <ul className="mt-3 space-y-2">
              {[
                "L'abonné est l'unique responsable du traitement au sens du RGPD",
                "SABITOU SOLUTIONS & SERVICES agit exclusivement en qualité de sous-traitant, hébergeant ces données pour le seul compte de l'abonné",
                "L'abonné s'engage à respecter les obligations du RGPD vis-à-vis de ses propres clients",
                "NoX VTC ne traite, n'exploite ni ne cède ces données à des tiers",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              En cas de demande d'un client de l'abonné relative à ses droits RGPD,
              il appartient à l'abonné d'y répondre. L'abonné peut solliciter
              l'assistance de l'éditeur à{" "}
              <a href="mailto:support@noxvtc.fr" className="text-gold hover:underline">
                support@noxvtc.fr
              </a>{" "}
              pour faciliter l'exercice de ces droits.
            </p>
          </Section>

          <Section title="8. Durée de conservation">
            <div className="divide-y divide-onyx-border">
              <Row
                label="Données de compte (abonnement actif)"
                value="Durée de l'abonnement"
              />
              <Row
                label="Données après résiliation"
                value="30 jours (export possible)"
              />
              <Row
                label="Données de facturation"
                value="10 ans (art. L123-22 Code de commerce)"
              />
            </div>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-onyx-border flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
          <Link
            href="/politique-de-cookies"
            className="hover:text-gold transition-colors"
          >
            Politique de cookies
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
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-6 rounded-2xl bg-onyx-card border border-onyx-border">
      <h2 className="text-[15px] font-semibold font-heading text-gold mb-4">{title}</h2>
      <div className="text-[13px] text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3 last:pb-0 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  )
}

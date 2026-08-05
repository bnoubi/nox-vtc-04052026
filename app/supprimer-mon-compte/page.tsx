// app/(public)/supprimer-mon-compte/page.tsx
// Page publique — accessible sans connexion
// URL: https://app.noxvtc.fr/supprimer-mon-compte

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Supprimer mon compte — NoX VTC",
  description:
    "Procédure de suppression de compte et de données personnelles sur NoX VTC.",
  robots: { index: false, follow: false },
};

export default function SupprimerMonComptePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "#f5f5f5",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 520, marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {/* Logo texte NoX */}
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "#ffffff",
            }}
          >
            NoX
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#666",
              borderLeft: "1px solid #333",
              paddingLeft: 12,
            }}
          >
            Gestion du compte
          </span>
        </div>

        {/* Titre */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 8,
            color: "#ffffff",
          }}
        >
          Supprimer mon compte
        </h1>
        <p style={{ color: "#888", fontSize: 14, lineHeight: 1.6 }}>
          Vous pouvez supprimer votre compte NoX VTC directement depuis
          l'application, ou soumettre une demande ci-dessous si vous n'avez
          plus accès à votre compte.
        </p>
      </div>

      {/* Card option 1 - via app */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: "#141414",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div
            style={{
              minWidth: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#1e1e1e",
              border: "1px solid #2a2a2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            📱
          </div>
          <div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
                color: "#fff",
              }}
            >
              Option 1 — Depuis l'application
            </h2>
            <p
              style={{ fontSize: 13, color: "#777", lineHeight: 1.7, margin: 0 }}
            >
              Connectez-vous à votre compte NoX VTC, puis suivez ce chemin :
            </p>
            <div
              style={{
                marginTop: 14,
                backgroundColor: "#0f0f0f",
                border: "1px solid #1f1f1f",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "#aaa",
                  margin: 0,
                  lineHeight: 1.9,
                }}
              >
                <Step n={1} text="Ouvrez l'application NoX VTC" />
                <Step n={2} text="Allez dans Paramètres & Offres (icône ⚙️)" />
                <Step n={3} text="Appuyez sur Compte & Sécurité" />
                <Step
                  n={4}
                  text={
                    <>
                      Dans la zone{" "}
                      <span style={{ color: "#e55" }}>Zone de danger</span>,
                      appuyez sur{" "}
                      <strong style={{ color: "#fff" }}>
                        Supprimer le compte
                      </strong>
                    </>
                  }
                />
                <Step n={5} text="Confirmez la suppression" />
              </p>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#555",
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              ⚠️ Cette action est <strong style={{ color: "#e55" }}>irréversible</strong>. Toutes vos données
              (courses, factures, véhicules, abonnement) seront supprimées
              définitivement.
            </p>
          </div>
        </div>
      </div>

      {/* Card option 2 - formulaire email */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: "#141414",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 28,
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div
            style={{
              minWidth: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#1e1e1e",
              border: "1px solid #2a2a2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            ✉️
          </div>
          <div style={{ width: "100%" }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
                color: "#fff",
              }}
            >
              Option 2 — Demande par email
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#777",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              Si vous n'avez plus accès à votre compte, envoyez un email à
              notre équipe avec l'adresse email liée à votre compte.
            </p>

            <a
              href="mailto:contact@noxvtc.fr?subject=Demande%20de%20suppression%20de%20compte&body=Bonjour%2C%0A%0AJe%20souhaite%20supprimer%20mon%20compte%20NoX%20VTC%20ainsi%20que%20toutes%20les%20donn%C3%A9es%20associ%C3%A9es.%0A%0AAdresse%20email%20du%20compte%20%3A%20%5BVotre%20email%5D%0A%0ACordialement"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                padding: "11px 18px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}
            >
              <span>📧</span>
              Envoyer un email à contact@noxvtc.fr
            </a>

            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                backgroundColor: "#0f0f0f",
                borderRadius: 10,
                border: "1px solid #1f1f1f",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: "#555",
                  margin: 0,
                  lineHeight: 1.7,
                }}
              >
                <strong style={{ color: "#666" }}>Données supprimées :</strong>{" "}
                profil, véhicules, courses, factures, jetons, abonnement.
                <br />
                <strong style={{ color: "#666" }}>Délai :</strong> traitement
                sous 30 jours (obligation RGPD).
                <br />
                <strong style={{ color: "#666" }}>Données conservées :</strong>{" "}
                données de facturation légales (5 ans, obligation fiscale
                française).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer liens légaux */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "flex",
          gap: 24,
          justifyContent: "center",
          paddingTop: 16,
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <Link
          href="/politique-de-confidentialite"
          style={{ fontSize: 12, color: "#555", textDecoration: "none" }}
        >
          Politique de confidentialité
        </Link>
        <Link
          href="/politique-de-cookies"
          style={{ fontSize: 12, color: "#555", textDecoration: "none" }}
        >
          Politique de cookies
        </Link>
        <Link
          href="/"
          style={{ fontSize: 12, color: "#555", textDecoration: "none" }}
        >
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}

// Composant helper Step
function Step({
  n,
  text,
}: {
  n: number;
  text: React.ReactNode;
}) {
  return (
    <span style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
      <span
        style={{
          minWidth: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "#1f1f1f",
          border: "1px solid #2f2f2f",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "#888",
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span style={{ color: "#aaa", fontSize: 13 }}>{text}</span>
    </span>
  );
}

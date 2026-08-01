type SaasInvoiceEmailProps = {
  userName: string
  prenom?: string
  numero: string
  description: string
  montantTTC: number
  montantHT: number
  tvaAmount: number
  pdfUrl: string
  type: 'subscription' | 'token_pack'
}

export function saasInvoiceEmail({
  userName,
  prenom,
  numero,
  description,
  montantTTC,
  montantHT,
  tvaAmount,
  pdfUrl,
  type,
}: SaasInvoiceEmailProps): { subject: string; html: string } {
  const subject = `Votre facture NoX VTC — ${numero}`
  const achatLabel = type === 'subscription' ? 'abonnement' : 'achat'

  function fmtEur(n: number): string {
    const parts = n.toFixed(2).split('.')
    return parts[0] + ',' + parts[1] + ' €'
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#0F0F0F;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0F0F0F;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#1A1A1A;border:1px solid #333;border-radius:16px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="font-family:Georgia,serif;font-size:48px;color:#C9A84C;line-height:1;">N</div>
                <div style="font-size:11px;letter-spacing:0.2em;color:#8B6914;margin-top:4px;">NoX VTC</div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 8px;">Bonjour${prenom ? ` ${prenom}` : ''},</p>
                <p style="margin:0 0 16px;">Merci pour votre achat.</p>
                <p style="margin:0 0 24px;">Votre facture suite à votre ${achatLabel} est disponible ci-dessous.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;">
                  <tr>
                    <td style="color:#A1A1AA;font-size:13px;padding-bottom:8px;">Numéro</td>
                    <td align="right" style="color:#F5F5F5;font-size:13px;font-weight:600;padding-bottom:8px;">${numero}</td>
                  </tr>
                  <tr>
                    <td style="color:#A1A1AA;font-size:13px;padding-bottom:8px;">Désignation</td>
                    <td align="right" style="color:#F5F5F5;font-size:13px;padding-bottom:8px;">${description}</td>
                  </tr>
                  <tr>
                    <td style="color:#A1A1AA;font-size:13px;padding-bottom:8px;">Montant HT</td>
                    <td align="right" style="color:#F5F5F5;font-size:13px;padding-bottom:8px;">${fmtEur(montantHT)}</td>
                  </tr>
                  <tr>
                    <td style="color:#A1A1AA;font-size:13px;padding-bottom:8px;">TVA 20%</td>
                    <td align="right" style="color:#F5F5F5;font-size:13px;padding-bottom:8px;">${fmtEur(tvaAmount)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:8px 0;">
                      <div style="border-top:1px solid #D4AF37;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#D4AF37;font-size:15px;font-weight:700;padding-top:4px;">Total TTC</td>
                    <td align="right" style="color:#D4AF37;font-size:15px;font-weight:700;padding-top:4px;">${fmtEur(montantTTC)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${pdfUrl}" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">Télécharger ma facture →</a>
              </td>
            </tr>
            <tr>
              <td style="color:#555;font-size:12px;line-height:1.6;border-top:1px solid #2a2a2a;padding-top:20px;">
                <p style="margin:0 0 6px;">Pour toute question : <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
                <p style="margin:0;color:#444;font-size:11px;">ALLO VTC 77 LA FERTE SOUS JOUARRE — SIREN 930159389 — TVA FR27930159389</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html }
}

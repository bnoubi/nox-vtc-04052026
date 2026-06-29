type SubscriptionExpiredProps = {
  userName: string
  planName: string
  expiredAt: string
}

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function subscriptionExpiredEmail({
  userName,
  planName,
  expiredAt,
}: SubscriptionExpiredProps): { subject: string; html: string } {
  const dateStr = formatDateFr(expiredAt)
  const subject = 'Votre abonnement NoX VTC a expiré'
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
                <p style="margin:0 0 16px;">Bonjour ${userName},</p>
                <p style="margin:0 0 8px;">Votre abonnement <strong style="color:#C9A84C;">${planName}</strong> a expiré le <strong>${dateStr}</strong>.</p>
                <p style="margin:0 0 8px;">Votre compte est maintenant en offre <strong>Starter</strong> (gratuite).</p>
                <p style="margin:0 0 24px;">Vos jetons acquis sont conservés et restent disponibles sur votre compte.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <p style="margin:0 0 12px;color:#A1A1AA;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Reprendre un abonnement</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="width:48%;background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;vertical-align:top;">
                      <div style="color:#C9A84C;font-weight:700;font-size:13px;margin-bottom:6px;">Pro</div>
                      <div style="color:#F5F5F5;font-size:20px;font-weight:700;margin-bottom:8px;">4,99&nbsp;€<span style="font-size:12px;font-weight:400;color:#A1A1AA;">/mois</span></div>
                      <div style="color:#A1A1AA;font-size:12px;line-height:1.6;">Max 2 chauffeurs<br/>Documents illimités</div>
                    </td>
                    <td style="width:4%;"></td>
                    <td style="width:48%;background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;vertical-align:top;">
                      <div style="color:#C9A84C;font-weight:700;font-size:13px;margin-bottom:6px;">Premium</div>
                      <div style="color:#F5F5F5;font-size:20px;font-weight:700;margin-bottom:8px;">9,99&nbsp;€<span style="font-size:12px;font-weight:400;color:#A1A1AA;">/mois</span></div>
                      <div style="color:#A1A1AA;font-size:12px;line-height:1.6;">Max 10 chauffeurs<br/>API &amp; Intégrations</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="https://app.noxvtc.fr" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">Choisir une offre →</a>
              </td>
            </tr>
            <tr>
              <td style="color:#A1A1AA;font-size:13px;line-height:1.6;border-top:1px solid #333;padding-top:20px;">
                <p style="margin:0 0 8px;">Pour toute question : <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
                <p style="margin:16px 0 0;color:#F5F5F5;">À très bientôt,<br/>L'équipe NoX VTC</p>
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

type TrialEndingProps = {
  prenom: string
  nom: string
}

export function trialEndingEmail({ prenom, nom }: TrialEndingProps): { subject: string; html: string } {
  const fullName = `${prenom} ${nom}`.trim()
  const subject = `Votre essai NoX VTC se termine dans 2 jours, ${prenom}`
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
                <p style="margin:0 0 16px;">Bonjour ${fullName},</p>
                <p style="margin:0 0 16px;">Votre période d'essai gratuit de 14 jours arrive à son terme <strong>dans 2 jours</strong>.</p>
                <p style="margin:0 0 24px;">Pour continuer à utiliser NoX VTC sans interruption, choisissez dès maintenant l'offre adaptée à votre activité.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <a href="https://app.noxvtc.fr/offres" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">Voir les offres →</a>
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

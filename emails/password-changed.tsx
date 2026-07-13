type PasswordChangedProps = {
  prenom: string
  nom: string
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export function passwordChangedEmail({ prenom, nom }: PasswordChangedProps): { subject: string; html: string } {
  const firstName = prenom.trim() || nom.trim() || 'cher utilisateur'
  const subject = 'Votre mot de passe NoX VTC a été modifié'
  const now = fmtDateTime(new Date().toISOString())

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
              <td align="center" style="padding-bottom:20px;">
                <div style="display:inline-block;background:#1A2A1A;border:1px solid #22C55E55;border-radius:12px;padding:16px 28px;text-align:center;">
                  <div style="font-size:32px;line-height:1;">&#x1F512;</div>
                  <div style="font-size:12px;color:#22C55E;margin-top:8px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Mot de passe modifié</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;padding-bottom:16px;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 14px;">Votre mot de passe NoX VTC a été modifié avec succès le <strong style="color:#C9A84C;">${now}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:20px;">
                <div style="padding:12px 16px;background:#2A1A1A;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;font-size:13px;color:#D4D4D8;line-height:1.6;">
                  Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement à <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="https://app.noxvtc.fr" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">Accéder à mon espace &#x2192;</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2A2A2A;padding-top:20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;">Pour toute question : <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
                <p style="margin:8px 0 0;font-size:12px;color:#6B6B6B;">L'équipe NoX VTC</p>
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

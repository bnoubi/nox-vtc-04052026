type PasswordResetCodeProps = {
  prenom: string
  code: string
}

export function passwordResetCodeEmail({ prenom, code }: PasswordResetCodeProps): { subject: string; html: string } {
  const firstName = prenom.trim() || 'cher utilisateur'
  const subject = 'Votre code de réinitialisation NoX VTC'
  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`

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
                <div style="display:inline-block;background:#1A1A2A;border:1px solid #C9A84C55;border-radius:12px;padding:16px 40px;text-align:center;">
                  <div style="font-size:12px;color:#8B6914;margin-bottom:8px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Code de réinitialisation</div>
                  <div style="font-size:36px;font-weight:700;color:#C9A84C;letter-spacing:0.15em;font-family:monospace;">${formattedCode}</div>
                  <div style="font-size:11px;color:#666;margin-top:8px;">Valable 10 minutes</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;padding-bottom:16px;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 14px;">Vous avez demandé la réinitialisation de votre mot de passe NoX VTC. Entrez le code ci-dessus dans l'application pour choisir un nouveau mot de passe.</p>
                <p style="margin:0;">Aucun lien à cliquer — saisissez simplement ce code.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:20px;">
                <div style="padding:12px 16px;background:#2A1A1A;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;font-size:13px;color:#D4D4D8;line-height:1.6;">
                  Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe reste inchangé. Contactez-nous à <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a> si vous pensez que votre compte est compromis.
                </div>
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

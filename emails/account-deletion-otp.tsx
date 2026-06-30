type AccountDeletionOtpProps = {
  userName: string
  code: string
}

export function accountDeletionOtpEmail({
  userName,
  code,
}: AccountDeletionOtpProps): { subject: string; html: string } {
  const subject = `Code de vérification — Suppression de compte NoX VTC`
  const spacedCode = code.split('').join(' ')
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
                <p style="margin:0 0 20px;">Voici votre code de vérification pour confirmer la suppression de votre compte :</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <div style="display:inline-block;background:#111;border:1px solid #C9A84C33;border-radius:14px;padding:20px 36px;">
                  <span style="font-family:Georgia,serif;font-size:36px;font-weight:700;color:#C9A84C;letter-spacing:0.18em;">${spacedCode}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;">Ce code expire dans <strong>10 minutes</strong>.</p>
                <p style="margin:0 0 0;color:#A1A1AA;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et contactez <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a> immédiatement.</p>
              </td>
            </tr>
            <tr>
              <td style="color:#A1A1AA;font-size:13px;line-height:1.6;border-top:1px solid #333;padding-top:20px;margin-top:24px;">
                <p style="margin:0 0 8px;padding-top:24px;">Pour toute question : <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
                <p style="margin:8px 0 0;color:#F5F5F5;">L'équipe NoX VTC</p>
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

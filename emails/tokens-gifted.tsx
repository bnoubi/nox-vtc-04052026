type TokensGiftedProps = {
  prenom: string
  nom: string
  amount: number
  balanceAfter: number
  motif?: string
}

export function tokensGiftedEmail({ prenom, nom, amount, balanceAfter, motif }: TokensGiftedProps): { subject: string; html: string } {
  const firstName = prenom.trim() || nom.trim() || 'cher utilisateur'
  const pl = amount > 1 ? 's' : ''
  const subject = `${amount} jeton${pl} offert${pl} sur votre compte NoX VTC`
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
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;background:#1D1A0A;border:1px solid #C9A84C55;border-radius:12px;padding:16px 28px;text-align:center;">
                  <div style="font-size:36px;font-weight:700;color:#C9A84C;line-height:1;">+${amount}</div>
                  <div style="font-size:12px;color:#8B6914;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">jeton${pl} offert${pl}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 14px;">L'équipe NoX VTC vous a offert <strong style="color:#C9A84C;">${amount} jeton${pl}</strong>. ${amount > 1 ? 'Ils sont' : 'Il est'} immédiatement disponible${pl} sur votre compte.</p>
                ${motif ? `<p style="margin:0 0 14px;padding:12px 16px;background:#252525;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;font-style:italic;color:#D4D4D8;">"${motif}"</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 0 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;text-align:center;">
                      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Nouveau solde</div>
                      <div style="font-size:22px;font-weight:700;color:#C9A84C;margin-top:6px;">${balanceAfter} jeton${balanceAfter > 1 ? 's' : ''}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="https://app.noxvtc.fr" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">Accéder à mon espace →</a>
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

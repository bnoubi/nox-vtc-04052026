type AdminRoleChangedProps =
  | {
      event: 'role_change'
      prenom: string
      nom: string
      memberEmail: string
      oldRoleLabel: string
      newRoleLabel: string
      newRoleColor: string
      changedByEmail: string
    }
  | {
      event: 'revoke'
      prenom: string
      nom: string
      memberEmail: string
      revokedRoleLabel: string
      revokedByEmail: string
    }

export function adminRoleChangedEmail(props: AdminRoleChangedProps): { subject: string; html: string } {
  const firstName = props.prenom.trim() || props.memberEmail.split('@')[0]

  if (props.event === 'revoke') {
    const subject = `Accès back-office NoX VTC révoqué — ${props.revokedRoleLabel}`
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
              <td style="padding-bottom:20px;">
                <div style="background:#1f0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:14px 18px;">
                  <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#ef4444;">Accès révoqué</span>
                  <div style="font-size:16px;font-weight:600;color:#ef4444;margin-top:4px;">${props.revokedRoleLabel}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 14px;">Votre accès au back-office NoX VTC a été révoqué par <strong style="color:#C9A84C;">${props.revokedByEmail}</strong>.</p>
                <p style="margin:0 0 20px;">Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2A2A2A;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#6B6B6B;"><a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
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

  const subject = `Modification de rôle back-office NoX VTC — ${props.newRoleLabel}`
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
              <td style="padding-bottom:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;">
                      <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Ancien rôle</span>
                      <div style="font-size:15px;font-weight:600;color:#A1A1AA;margin-top:4px;">${props.oldRoleLabel}</div>
                    </td>
                    <td style="width:32px;text-align:center;color:#C9A84C;font-size:20px;">→</td>
                    <td style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;">
                      <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Nouveau rôle</span>
                      <div style="font-size:15px;font-weight:600;color:${props.newRoleColor};margin-top:4px;">${props.newRoleLabel}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 20px;">Votre rôle sur le back-office NoX VTC a été modifié par <strong style="color:#C9A84C;">${props.changedByEmail}</strong>. Vos nouvelles autorisations sont effectives immédiatement.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2A2A2A;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#6B6B6B;"><a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
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

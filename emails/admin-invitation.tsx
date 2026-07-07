type AdminInvitationProps = {
  prenom: string
  nom: string
  roleLabel: string
  roleDescription: string
  invitedByEmail: string
  inviteLink: string
}

export function adminInvitationEmail({
  prenom,
  nom,
  roleLabel,
  roleDescription,
  invitedByEmail,
  inviteLink,
}: AdminInvitationProps): { subject: string; html: string } {
  const firstName = prenom.trim() || 'Collaborateur'
  const fullName = [prenom, nom].filter(Boolean).join(' ').trim() || firstName
  const subject = `Invitation Back-Office NoX VTC — Rôle ${roleLabel}`

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
                <div style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;display:inline-block;width:100%;box-sizing:border-box;">
                  <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Rôle attribué</span>
                  <div style="font-size:16px;font-weight:600;color:#C9A84C;margin-top:4px;">${roleLabel}</div>
                  <div style="font-size:12px;color:#A1A1AA;margin-top:2px;">${roleDescription}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;">Bonjour ${fullName},</p>
                <p style="margin:0 0 14px;">Vous avez été invité(e) à rejoindre le back-office NoX VTC par <strong style="color:#C9A84C;">${invitedByEmail}</strong>.</p>
                <p style="margin:0 0 20px;">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre accès. Ce lien est valable 24 heures.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 0 28px;">
                <a href="${inviteLink}" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;letter-spacing:0.02em;">Activer mon accès →</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2A2A2A;padding-top:20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                <p style="margin:0;font-size:12px;color:#6B6B6B;">Lien valable 24h — <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
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

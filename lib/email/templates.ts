export function templateBienvenue(prenom: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#0F0F0F;padding:28px 40px">
          <p style="margin:0;font-size:22px;font-weight:700;color:#CCFF00;letter-spacing:-0.5px">NoX VTC</p>
        </td></tr>
        <tr><td style="padding:36px 40px 28px">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F0F0F">Bienvenue, ${prenom}&nbsp;!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444">
            Votre compte NoX VTC est prêt. Vous pouvez dès maintenant accéder à votre espace et commencer à utiliser la plateforme.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#444">
            Si vous avez la moindre question, notre équipe est là pour vous aider.
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px">
          <p style="margin:0;font-size:13px;color:#888">© ${new Date().getFullYear()} NoX VTC — noreply@noxvtc.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function templateMessage(sujet: string, message: string): string {
  const lines = message.split('\n').map(l => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#444">${l || '&nbsp;'}</p>`).join('')
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#0F0F0F;padding:28px 40px">
          <p style="margin:0;font-size:22px;font-weight:700;color:#CCFF00;letter-spacing:-0.5px">NoX VTC</p>
        </td></tr>
        <tr><td style="padding:36px 40px 28px">
          <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0F0F0F">${sujet}</h1>
          ${lines}
        </td></tr>
        <tr><td style="padding:0 40px 32px">
          <p style="margin:0;font-size:13px;color:#888">© ${new Date().getFullYear()} NoX VTC — noreply@noxvtc.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

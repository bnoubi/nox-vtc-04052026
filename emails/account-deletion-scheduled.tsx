type AccountDeletionScheduledProps = {
  userName: string
  deletionDate: string
}

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function accountDeletionScheduledEmail({
  userName,
  deletionDate,
}: AccountDeletionScheduledProps): { subject: string; html: string } {
  const dateStr = formatDateFr(deletionDate)
  const subject = `Confirmation de votre demande de suppression de compte`

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

            <!-- Logo -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="font-family:Georgia,serif;font-size:48px;color:#C9A84C;line-height:1;">N</div>
                <div style="font-size:11px;letter-spacing:0.2em;color:#8B6914;margin-top:4px;">NoX VTC</div>
              </td>
            </tr>

            <!-- Corps -->
            <tr>
              <td style="color:#F5F5F5;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 16px;">Bonjour ${userName},</p>
                <p style="margin:0 0 24px;">Nous avons bien reçu votre demande de suppression de compte NoX VTC.</p>

                <!-- Encart date de suppression -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#2A1A1A;border:1px solid #7F1D1D;border-radius:12px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:20px;text-align:center;">
                      <div style="font-size:11px;color:#FCA5A5;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.12em;">Suppression programmée le</div>
                      <div style="font-size:20px;font-weight:700;color:#FEF2F2;">${dateStr}</div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 24px;color:#A1A1AA;font-size:14px;line-height:1.6;">
                  Pendant cette période, vous pouvez annuler cette demande en contactant
                  <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a>.
                </p>

                <!-- Ce qui sera supprimé -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1E1E1E;border:1px solid #3F3F3F;border-radius:12px;margin:0 0 16px;">
                  <tr>
                    <td style="padding:20px;">
                      <div style="font-size:13px;font-weight:600;color:#F5F5F5;margin-bottom:12px;">Ce qui sera supprimé</div>
                      <ul style="margin:0;padding:0 0 0 18px;color:#A1A1AA;font-size:13px;line-height:1.9;">
                        <li>Vos données personnelles (nom, coordonnées)</li>
                        <li>Votre profil entreprise</li>
                        <li>Vos documents (bons de commande, factures clients)</li>
                        <li>Votre accès à NoX VTC</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <!-- Ce qui sera conservé -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#162316;border:1px solid #166534;border-radius:12px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:20px;">
                      <div style="font-size:13px;font-weight:600;color:#F5F5F5;margin-bottom:12px;">Ce qui sera conservé</div>
                      <p style="margin:0;color:#A1A1AA;font-size:13px;line-height:1.7;">
                        Conformément à nos obligations légales comptables (Code de commerce, art. L123-22), vos factures seront
                        conservées de manière sécurisée et archivée pendant 10 ans. Ces données ne seront accessibles qu'en cas
                        de contrôle fiscal ou d'obligation légale, et ne seront plus utilisées à aucune autre fin.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Pied de page -->
            <tr>
              <td style="color:#A1A1AA;font-size:13px;line-height:1.6;border-top:1px solid #333;padding-top:20px;">
                <p style="margin:0 0 8px;">Pour toute question : <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
                <p style="margin:0 0 0;font-size:11px;color:#52525B;">
                  NoX VTC — ALLO VTC 77 LA FERTE SOUS JOUARRE — SIREN 930159389<br/>
                  Conformément au RGPD (Art. 17) et à la loi Informatique et Libertés.
                </p>
                <p style="margin:16px 0 0;color:#F5F5F5;">L'équipe NoX VTC</p>
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

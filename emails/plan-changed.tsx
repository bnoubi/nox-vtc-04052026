type PlanChangedProps = {
  prenom: string
  nom: string
  oldPlan: string
  newPlan: string
  endDate?: string | null
}

function fmtPlanLabel(code: string): string {
  const c = code.toLowerCase()
  if (c === 'duo') return 'Pro'
  if (c === 'team') return 'Premium'
  return 'Starter'
}

function fmtPlanColor(code: string): string {
  const c = code.toLowerCase()
  if (c === 'duo') return '#3B82F6'
  if (c === 'team') return '#C5A059'
  return '#6B7280'
}

function fmtPlanLimits(code: string): { drivers: number; vehicles: number } {
  const c = code.toLowerCase()
  if (c === 'duo') return { drivers: 2, vehicles: 2 }
  if (c === 'team') return { drivers: 10, vehicles: 10 }
  return { drivers: 1, vehicles: 1 }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export function planChangedEmail({ prenom, nom, oldPlan, newPlan, endDate }: PlanChangedProps): { subject: string; html: string } {
  const firstName = prenom.trim() || nom.trim() || 'cher utilisateur'
  const oldLabel = fmtPlanLabel(oldPlan)
  const newLabel = fmtPlanLabel(newPlan)
  const oldColor = fmtPlanColor(oldPlan)
  const newColor = fmtPlanColor(newPlan)
  const oldLimits = fmtPlanLimits(oldPlan)
  const newLimits = fmtPlanLimits(newPlan)
  const oldUnlimited = oldPlan.toLowerCase() !== 'solo'
  const newUnlimited = newPlan.toLowerCase() !== 'solo'
  const today = fmtDate(new Date().toISOString())
  const subject = `Votre abonnement NoX VTC est passé en ${newLabel}`

  const driversRow = oldLimits.drivers !== newLimits.drivers
    ? `<tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;color:#A1A1AA;font-size:14px;">Chauffeurs</td><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;"><span style="color:#A1A1AA;">${oldLimits.drivers}</span> <span style="color:#C9A84C;">→</span> <strong style="color:${newColor};">${newLimits.drivers === 10 ? '10' : newLimits.drivers}</strong></td></tr>`
    : ''

  const vehiclesRow = oldLimits.vehicles !== newLimits.vehicles
    ? `<tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;color:#A1A1AA;font-size:14px;">Véhicules</td><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;"><span style="color:#A1A1AA;">${oldLimits.vehicles}</span> <span style="color:#C9A84C;">→</span> <strong style="color:${newColor};">${newLimits.vehicles === 10 ? '10' : newLimits.vehicles}</strong></td></tr>`
    : ''

  const invoicesRow = !oldUnlimited && newUnlimited
    ? `<tr><td style="padding:8px 0;color:#A1A1AA;font-size:14px;">Factures</td><td style="padding:8px 0;text-align:right;"><span style="color:#A1A1AA;">Jetons requis</span> <span style="color:#C9A84C;">→</span> <strong style="color:${newColor};">Illimitées</strong></td></tr>`
    : ''

  const benefitsTable = (driversRow || vehiclesRow || invoicesRow)
    ? `<tr>
        <td style="padding-bottom:20px;">
          <div style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:16px 18px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;margin-bottom:10px;">Nouveaux avantages</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${driversRow}${vehiclesRow}${invoicesRow}
            </table>
          </div>
        </td>
      </tr>`
    : ''

  const trialBanner = endDate
    ? `<tr>
        <td style="padding-bottom:20px;">
          <div style="background:#1D1A0A;border:1px solid #C9A84C55;border-radius:10px;padding:14px 18px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Période d'accès</div>
            <div style="font-size:14px;color:#F5F5F5;margin-top:6px;">Offre valable jusqu'au <strong style="color:#C9A84C;">${fmtDate(endDate)}</strong></div>
          </div>
        </td>
      </tr>`
    : ''

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
                      <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Ancien abonnement</span>
                      <div style="font-size:15px;font-weight:600;color:${oldColor};margin-top:4px;">${oldLabel}</div>
                    </td>
                    <td style="width:32px;text-align:center;color:#C9A84C;font-size:20px;">→</td>
                    <td style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;">
                      <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Nouvel abonnement</span>
                      <div style="font-size:15px;font-weight:600;color:${newColor};margin-top:4px;">${newLabel}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;padding-bottom:16px;">
                <p style="margin:0 0 14px;">Bonjour ${firstName},</p>
                <p style="margin:0 0 14px;">Votre abonnement NoX VTC est passé en <strong style="color:${newColor};">${newLabel}</strong>. Vos nouveaux accès sont effectifs immédiatement (depuis le ${today}).</p>
              </td>
            </tr>
            ${benefitsTable}
            ${trialBanner}
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

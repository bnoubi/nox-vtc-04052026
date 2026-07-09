export const ROLE_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Accès total à toutes les fonctionnalités du back-office',
    color: '#a855f7',
  },
  admin: {
    label: 'Admin',
    description: 'Gestion complète — utilisateurs, abonnements, jetons, analytics, tickets',
    color: '#C9A84C',
  },
  support: {
    label: 'Support',
    description: 'Consultation des utilisateurs et abonnements, gestion des tickets',
    color: '#3b82f6',
  },
  finance: {
    label: 'Finance',
    description: 'Consultation des abonnements, paiements et analytics',
    color: '#22c55e',
  },
}

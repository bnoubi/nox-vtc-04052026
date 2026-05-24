const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: 'Actif',      color: '#38A169' },
  suspended: { label: 'Désactivé', color: '#DD6B20' },
  trialing:  { label: 'Essai',      color: '#3182CE' },
  expired:   { label: 'Expiré',     color: '#718096' },
  deleted:   { label: 'Supprimé',  color: '#E53E3E' },
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = status ? STATUS_CONFIG[status] : null
  if (!cfg) {
    return <span className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>—</span>
  }
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${cfg.color}26`, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

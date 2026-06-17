import { CheckCircle2, XCircle } from "lucide-react"

export function isPasswordStrong(pwd: string) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
}

export function PasswordStrengthIndicator({ password, show }: { password: string; show: boolean }) {
  if (!show) return null

  const criteria = [
    { label: "Au moins 8 caractères", valid: password.length >= 8 },
    { label: "Au moins une majuscule", valid: /[A-Z]/.test(password) },
    { label: "Au moins un chiffre", valid: /[0-9]/.test(password) },
    { label: "Au moins un caractère spécial", valid: /[^A-Za-z0-9]/.test(password) }
  ]

  return (
    <div className="mt-2 space-y-1.5 p-3 rounded-xl bg-black/40 border border-[#D4AF37]/20">
      {criteria.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] font-medium">
          {c.valid ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500/80" strokeWidth={2} />
          )}
          <span className={c.valid ? "text-emerald-500" : "text-[#888888]"}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  )
}

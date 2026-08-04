"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { parsePhoneNumber, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js"
import { cn } from "@/lib/utils"

function flagEmoji(code: string): string {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

function normalizeSearch(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const _intlNames = typeof Intl !== "undefined" && Intl.DisplayNames
  ? new Intl.DisplayNames(["fr"], { type: "region" })
  : null

const ALL_COUNTRIES: { code: CountryCode; dial: string; name: string; flag: string }[] =
  getCountries()
    .map(code => ({
      code,
      dial: `+${getCountryCallingCode(code)}`,
      name: _intlNames?.of(code) ?? code,
      flag: flagEmoji(code),
    }))
    .sort((a, b) => a.code === "FR" ? -1 : b.code === "FR" ? 1 : (a.name ?? "").localeCompare(b.name ?? "", "fr"))

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  // Visual overrides — pass background + border + text classes
  fieldCls?: string
}

const DEFAULT_FIELD = "bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"

export function PhoneInput({
  value,
  onChange,
  required,
  disabled,
  placeholder = "6 12 34 56 78",
  fieldCls,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>("FR")
  const [local, setLocal] = useState("")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const lastEmitted = useRef<string>("")

  const dial = `+${getCountryCallingCode(country)}`

  useEffect(() => {
    if (value === lastEmitted.current) return
    if (!value) {
      setLocal("")
      setCountry("FR")
      lastEmitted.current = ""
      return
    }
    try {
      const parsed = parsePhoneNumber(value)
      if (parsed?.country) {
        setCountry(parsed.country as CountryCode)
        setLocal(parsed.nationalNumber)
        lastEmitted.current = value
        return
      }
    } catch {}
    setLocal(value)
  }, [value])

  function emit(newLocal: string, newCountry: CountryCode) {
    const d = `+${getCountryCallingCode(newCountry)}`
    const raw = d + newLocal.replace(/[\s\-().]/g, "")
    lastEmitted.current = raw
    onChange(raw)
  }

  function handleLocal(v: string) { setLocal(v); emit(v, country) }
  function handleCountry(c: CountryCode) { setCountry(c); setOpen(false); setSearch(""); emit(local, c) }

  const filtered = useMemo(() => {
    if (!search) return ALL_COUNTRIES
    const q = normalizeSearch(search)
    return ALL_COUNTRIES.filter(c =>
      normalizeSearch(c.name).includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [search])

  const vis = fieldCls ?? DEFAULT_FIELD

  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setSearch("") }}
          disabled={disabled}
          className={cn("flex items-center gap-1.5 whitespace-nowrap px-3 py-3 rounded-xl", vis)}
        >
          <span>{flagEmoji(country)}</span>
          <span>{dial}</span>
          <span className="text-muted-foreground text-xs ml-0.5">▾</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch("") }} />
            <div className="absolute z-50 top-full mt-1 left-0 w-60 rounded-xl bg-[#111111] border border-onyx-border/50 shadow-xl overflow-hidden">
              <div className="p-2 border-b border-onyx-border/30">
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="w-full h-8 rounded-lg bg-secondary/40 border border-onyx-border/50 text-xs text-foreground px-3 focus:outline-none focus:border-gold/50"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto">
                {filtered.map(c => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => handleCountry(c.code)}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-white/5 flex items-center gap-2"
                    >
                      <span>{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground">{c.dial}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      <input
        type="tel"
        value={local}
        onChange={(e) => handleLocal(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={cn("flex-1 px-4 py-3 rounded-xl placeholder:text-muted-foreground", vis)}
        style={{ fontSize: "16px" }}
      />
    </div>
  )
}

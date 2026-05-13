"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

// setOptions doit être appelé avant tout importLibrary. On l'exécute au chargement du module
// (et non à l'intérieur d'un composant) pour garantir qu'il précède tout importLibrary,
// y compris ceux déclenchés depuis d'autres fichiers (ex. create-bc.tsx → importLibrary("routes")).
// Le guard typeof window évite l'erreur SSR lors du prerendering Next.js.
if (typeof window !== "undefined") {
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    v: "weekly",
    language: "fr",
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let placesLibPromise: Promise<any> | null = null

function getPlacesLib() {
  if (!placesLibPromise) {
    placesLibPromise = importLibrary("places")
      .then((lib) => lib)
      .catch((err) => {
        console.error("[PlacesAutocomplete] ❌ Échec chargement Places library:", err)
        placesLibPromise = null
        return null
      })
  }
  return placesLibPromise
}

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPostalCode?: (value: string) => void
  onCity?: (value: string) => void
  onCountry?: (value: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  // "full" = rue+ville+pays (départ/arrivée BC) — "street" = rue seule (fiches adresse)
  addressMode?: "full" | "street"
}

export function PlacesAutocomplete({
  value,
  onChange,
  onPostalCode,
  onCity,
  onCountry,
  placeholder = "Adresse",
  className = "",
  style,
  addressMode = "street",
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [suggestions, setSuggestions] = useState<
    { placeId: string; text: string; secondary: string }[]
  >([])
  const [showDropdown, setShowDropdown] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessionToken, setSessionToken] =
    useState<any>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click/tap (mousedown for desktop, touchstart for mobile)
  useEffect(() => {
    function handleOutside(e: Event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("touchstart", handleOutside, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("touchstart", handleOutside)
    }
  }, [])

  // Create fresh session token on mount and after each selection
  const refreshToken = useCallback(async () => {
    try {
      const places = await getPlacesLib()
      if (!places) return
      const token = new places.AutocompleteSessionToken()
      setSessionToken(token)
    } catch {
      // Silently fail if Places API not available
    }
  }, [])

  useEffect(() => {
    refreshToken()
  }, [refreshToken])

  // Fetch suggestions using Places (New) AutocompleteSuggestion
  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!input || input.length < 3) {
        setSuggestions([])
        setShowDropdown(false)
        return
      }

      try {
        const places = await getPlacesLib()
        if (!places) return
        const request = {
          input,
          includedPrimaryTypes: ["street_address", "route", "transit_station", "airport", "establishment"],
          includedRegionCodes: ["fr", "be", "ch", "lu", "mc"],
          language: "fr",
          ...(sessionToken ? { sessionToken } : {}),
        }

        const { suggestions: results } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            request
          )

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (results as any[])
          .filter((s: any) => s.placePrediction)
          .slice(0, 5)
          .map((s: any) => {
            const pred = s.placePrediction!
            return {
              placeId: pred.placeId,
              // .text est un objet FormattableText, pas une string — on extrait .text
              text: pred.mainText?.text || pred.text?.text || "",
              secondary: pred.secondaryText?.text || "",
            }
          })

        setSuggestions(mapped)
        setShowDropdown(mapped.length > 0)
      } catch {
        // Fallback: no suggestions
        setSuggestions([])
        setShowDropdown(false)
      }
    },
    [sessionToken]
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  async function handleSelect(suggestion: {
    placeId: string
    text: string
    secondary: string
  }) {
    // Provisional value while we fetch address components
    onChange(suggestion.text)
    setSuggestions([])
    setShowDropdown(false)

    try {
      const places = await getPlacesLib()
      if (places) {
        const place = new places.Place({ id: suggestion.placeId })
        await place.fetchFields({ fields: ["addressComponents"] })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = place.addressComponents || []

        let streetNumber = ""
        let route = ""
        let postalCode = ""
        let locality = ""
        let country = ""

        for (const comp of components) {
          const types: string[] = comp.types || []
          const text = comp.longText || comp.shortText || ""
          if (types.includes("street_number")) streetNumber = text
          if (types.includes("route")) route = text
          if (types.includes("postal_code")) postalCode = text
          if (types.includes("locality")) locality = text
          if (types.includes("country")) country = text
        }

        let displayAddress: string
        if (addressMode === "full") {
          // Adresse complète : rue + ville + pays (départ/arrivée BC)
          if (route) {
            const street = streetNumber ? `${streetNumber} ${route}` : route
            displayAddress = [street, locality, country].filter(Boolean).join(", ")
          } else {
            // POI (aéroport, gare, hôtel…)
            displayAddress = [suggestion.text, locality, country].filter(Boolean).join(", ")
          }
        } else {
          // Mode "street" : rue seule (fiches client, chauffeur, profil…)
          if (route) {
            displayAddress = streetNumber ? `${streetNumber} ${route}` : route
          } else {
            displayAddress = suggestion.text
          }
        }
        onChange(displayAddress)

        if (onPostalCode) onPostalCode(postalCode)
        if (onCity) onCity(locality)
        if (onCountry) onCountry(country)
      }
    } catch {
      // Non-critical: provisional value remains
    }

    refreshToken()
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true)
          // After keyboard appears on mobile, scroll input into view so dropdown is visible
          setTimeout(() => inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300)
        }}
        placeholder={placeholder}
        className={`w-full ${className ?? ""}`}
        style={style}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 rounded-xl bg-[#1a1a1a] border border-[#333] shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.placeId + i}
              type="button"
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(s) }}
              onClick={() => handleSelect(s)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <svg
                className="h-4 w-4 text-[#D4AF37]/60 mt-0.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F5F5F5] truncate">{s.text}</p>
                {s.secondary && (
                  <p className="text-[10px] text-[#888] truncate">
                    {s.secondary}
                  </p>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 border-t border-[#333] flex justify-end">
            <img
              src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_non_white.png"
              alt="Powered by Google"
              className="h-3 opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  )
}

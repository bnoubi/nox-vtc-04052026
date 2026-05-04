"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

// Singleton promise — l'API n'est chargée qu'une seule fois
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let placesLibPromise: Promise<any> | null = null
let optionsSet = false

function getPlacesLib() {
  if (!placesLibPromise) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

    if (!optionsSet) {
      setOptions({ key: apiKey, v: "weekly", language: "fr" })
      optionsSet = true
    }

    placesLibPromise = importLibrary("places").then((lib) => {
      return lib
    }).catch((err) => {
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
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function PlacesAutocomplete({
  value,
  onChange,
  onPostalCode,
  onCity,
  placeholder = "Adresse",
  className = "",
  style,
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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
              text: pred.mainText?.toString() || pred.text?.toString() || "",
              secondary: pred.secondaryText?.toString() || "",
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
    const fullAddress = suggestion.secondary
      ? `${suggestion.text}, ${suggestion.secondary}`
      : suggestion.text

    onChange(fullAddress)
    setSuggestions([])
    setShowDropdown(false)

    // Extract postal_code and locality from addressComponents if callbacks provided
    if (onPostalCode || onCity) {
      try {
        const places = await getPlacesLib()
        if (places) {
          const place = new places.Place({ id: suggestion.placeId })
          await place.fetchFields({ fields: ["addressComponents"] })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const components: any[] = place.addressComponents || []
          for (const comp of components) {
            const types: string[] = comp.types || []
            if (onPostalCode && types.includes("postal_code")) {
              onPostalCode(comp.longText || comp.shortText || "")
            }
            if (onCity && types.includes("locality")) {
              onCity(comp.longText || comp.shortText || "")
            }
          }
        }
      } catch {
        // Non-critical: address was already set, components extraction is best-effort
      }
    }

    // Refresh session token after selection (billing best practice)
    refreshToken()
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true)
        }}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 rounded-xl bg-[#1a1a1a] border border-[#333] shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.placeId + i}
              type="button"
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

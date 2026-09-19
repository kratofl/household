// Merchants are where money went, independent of the category that says what for.
// Catalog merchants ship with the app and are the same for everyone; the rest belong
// to the signed-in user. See ADR 0033.

import { apiRequest } from "@/lib/api"

import { tileColor } from "./tile-colors"

export type Merchant = {
  id: string
  name: string
  /** Names a logo file shipped under `public/merchants`. Null means the monogram is used. */
  logoKey: string | null
  /** The brand's own colour as #RRGGBB. Null falls back to the hashed tile colour. */
  color: string | null
  /** Catalog merchants are ours, so the user can pick them but not edit them. */
  catalog: boolean
  archived: boolean
}

const root = "/budget/merchants"

export function loadMerchants(accessToken: string) {
  return apiRequest<Merchant[]>(`${root}/`, { accessToken })
}

/** `global` publishes to every user and is refused for anyone but an admin. */
export function createMerchant(accessToken: string, name: string, global = false) {
  return apiRequest<Merchant>(`${root}/`, { accessToken, method: "POST", body: { name, global } })
}

export function updateMerchant(accessToken: string, id: string, body: { name: string; archived: boolean }) {
  return apiRequest<Merchant>(`${root}/${id}`, { accessToken, method: "PATCH", body })
}

export function logoUrl(merchant: Merchant) {
  return merchant.logoKey ? `/merchants/${merchant.logoKey}.svg` : null
}

/** Up to two letters that still read as the merchant: "Bäckerei Schmitt" becomes BS, "dm" becomes DM. */
export function monogram(name: string) {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return "?"
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return letters.toLocaleUpperCase()
}

/** The brand colour where we ship one, otherwise the same stable hash categories use. */
export function merchantColor(merchant: Merchant) {
  return merchant.color ?? tileColor(merchant.name)
}

/**
 * Monogram ink for a tile. Brand colours run from Starbucks green to DHL yellow, so the
 * white that icon tiles use would vanish on the bright ones. Picks by WCAG relative
 * luminance; the hashed colours are all dark and keep their white.
 */
export function monogramInk(background: string) {
  const hex = /^#([0-9a-f]{6})$/i.exec(background)
  if (!hex) return "#fff"
  const channel = (offset: number) => {
    const value = parseInt(hex[1].slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  return luminance > 0.4 ? "#1c1c1e" : "#fff"
}

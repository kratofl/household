// Device-level look and feel. Each setting is one CSS variable on <html>, so the
// whole design system follows it without any component knowing about the slider.
// Stored next to the theme and the locale; see globals.css for what reads them.

export type Appearance = {
  /** How solid translucent surfaces are. Lower is more see-through. */
  glassOpacity: number
  /** Multiplier on hairlines, separators and borders. */
  contrast: number
  /** How long panels take to open and close, in milliseconds. 0 turns it off. */
  panelMotionMs: number
}

export const appearanceLimits = {
  glassOpacity: { min: 0.3, max: 1, step: 0.02 },
  contrast: { min: 0.5, max: 1.5, step: 0.05 },
  panelMotionMs: { min: 0, max: 500, step: 25 },
} as const

export const defaultAppearance: Appearance = {
  glassOpacity: 0.62,
  contrast: 1,
  panelMotionMs: 225,
}

export const APPEARANCE_STORAGE_KEY = "household.appearance"

function clamp(value: number, key: keyof Appearance) {
  const { min, max } = appearanceLimits[key]
  return Math.min(max, Math.max(min, value))
}

/** Reads the stored settings, falling back per field so a partial value still loads. */
export function readAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return defaultAppearance
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return defaultAppearance
    const stored = parsed as Partial<Record<keyof Appearance, unknown>>
    const pick = (key: keyof Appearance) =>
      typeof stored[key] === "number" && Number.isFinite(stored[key]) ? clamp(stored[key], key) : defaultAppearance[key]
    return { glassOpacity: pick("glassOpacity"), contrast: pick("contrast"), panelMotionMs: pick("panelMotionMs") }
  } catch {
    return defaultAppearance
  }
}

/** Puts the settings on <html> and remembers them for the next load. */
export function applyAppearance(appearance: Appearance) {
  const style = document.documentElement.style
  style.setProperty("--glass-opacity", String(appearance.glassOpacity))
  style.setProperty("--contrast", String(appearance.contrast))
  style.setProperty("--motion-panel", `${appearance.panelMotionMs}ms`)
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
}

/**
 * Runs before the first paint so surfaces are not repainted after hydration.
 * Kept as a string because the root layout injects it as an inline script.
 */
export const appearanceInitScript = `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})||"null");if(!a)return;var s=document.documentElement.style;if(typeof a.glassOpacity==="number")s.setProperty("--glass-opacity",String(a.glassOpacity));if(typeof a.contrast==="number")s.setProperty("--contrast",String(a.contrast));if(typeof a.panelMotionMs==="number")s.setProperty("--motion-panel",a.panelMotionMs+"ms")}catch(e){}})()`

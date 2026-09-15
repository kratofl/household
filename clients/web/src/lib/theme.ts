// Accent themes. The id is what a profile stores; the presets live in globals.css
// as [data-theme="<id>"] rules, so switching is one attribute on <html>.

export type ThemeId = "mandarine" | "lagune" | "ozean" | "farn" | "heidelbeere" | "himbeere" | "graphit"

export type Theme = {
  id: ThemeId
  name: { de: string; en: string }
  /** Accent in light and dark appearance, for swatches and docs. */
  light: string
  dark: string
}

export const themes: Theme[] = [
  { id: "mandarine", name: { de: "Mandarine", en: "Tangerine" }, light: "#FF6A00", dark: "#FF7D1F" },
  { id: "lagune", name: { de: "Lagune", en: "Lagoon" }, light: "#008D94", dark: "#3EBFC6" },
  { id: "ozean", name: { de: "Ozean", en: "Ocean" }, light: "#007AFF", dark: "#0A84FF" },
  { id: "farn", name: { de: "Farn", en: "Fern" }, light: "#2A904B", dark: "#5AC576" },
  { id: "heidelbeere", name: { de: "Heidelbeere", en: "Blueberry" }, light: "#5856D6", dark: "#7D7AFF" },
  { id: "himbeere", name: { de: "Himbeere", en: "Raspberry" }, light: "#DA3870", dark: "#FD6C95" },
  { id: "graphit", name: { de: "Graphit", en: "Graphite" }, light: "#1D1D1F", dark: "#F5F5F7" },
]

export const defaultThemeId: ThemeId = "mandarine"

export const THEME_STORAGE_KEY = "household.theme"

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value)
}

/** Applies a theme to the document and remembers it for the next load. */
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
  window.localStorage.setItem(THEME_STORAGE_KEY, id)
}

/**
 * Runs before the first paint so the stored theme is on <html> before hydration.
 * Kept as a string because it is injected as an inline script from the root layout.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t&&${JSON.stringify(themes.map((theme) => theme.id))}.indexOf(t)>-1){document.documentElement.dataset.theme=t}}catch(e){}})()`

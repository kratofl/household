import type { Locale } from "@/lib/i18n"

export type AppModule = {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  active: boolean
}

type ModuleCatalogEntry = {
  route: string
  defaultEnabled: boolean
  defaultActive: boolean
  name: Record<Locale, string>
  description: Record<Locale, string>
}

export const moduleCatalog = {
  budget: {
    route: "/budget",
    defaultEnabled: true,
    defaultActive: true,
    name: { de: "Budget", en: "Budget" },
    description: {
      de: "Ausgaben, Kategorien, Limits, Konten und Sparziele.",
      en: "Expenses, categories, limits, accounts, and savings goals.",
    },
  },
  shopping: {
    route: "/shopping",
    defaultEnabled: false,
    defaultActive: false,
    name: { de: "Einkaufsliste", en: "Shopping List" },
    description: {
      de: "Gemeinsame Listen für Haushaltseinkäufe.",
      en: "Plan and share household shopping lists.",
    },
  },
  recipes: {
    route: "/recipes",
    defaultEnabled: false,
    defaultActive: false,
    name: { de: "Rezepte", en: "Recipes" },
    description: {
      de: "Rezepte sammeln und für Essenspläne verwenden.",
      en: "Manage recipes and reuse them for meal plans.",
    },
  },
  meal_plan: {
    route: "/meal-plan",
    defaultEnabled: false,
    defaultActive: false,
    name: { de: "Essensplan", en: "Meal Plan" },
    description: {
      de: "Mahlzeiten über Woche und Kalender planen.",
      en: "Plan meals across the week and calendar.",
    },
  },
  calendar: {
    route: "/calendar",
    defaultEnabled: false,
    defaultActive: false,
    name: { de: "Kalender", en: "Calendar" },
    description: {
      de: "Haushaltstermine sichtbar machen.",
      en: "Coordinate household events and schedules.",
    },
  },
  waste_schedule: {
    route: "/waste-schedule",
    defaultEnabled: false,
    defaultActive: false,
    name: { de: "Müllplan", en: "Waste Schedule" },
    description: {
      de: "Abholtermine und Erinnerungen für Tonnen.",
      en: "Track waste collection dates and reminders.",
    },
  },
} as const satisfies Record<string, ModuleCatalogEntry>

export const moduleKeys = Object.keys(moduleCatalog) as Array<keyof typeof moduleCatalog>

export const budgetViews = {
  overview: { route: "/budget", segment: "", labelKey: "budget.nav.overview" },
  transactions: {
    route: "/budget/transactions",
    segment: "transactions",
    labelKey: "budget.nav.transactions",
  },
  planning: { route: "/budget/planning", segment: "planning", labelKey: "budget.nav.planning" },
  saving: {
    route: "/budget/saving-investing",
    segment: "saving-investing",
    labelKey: "budget.nav.saving",
  },
  wishlist: { route: "/budget/wishlist", segment: "wishlist", labelKey: "budget.nav.wishlist" },
  categories: {
    route: "/budget/categories",
    segment: "categories",
    labelKey: "budget.nav.categories",
  },
  reports: { route: "/budget/reports", segment: "reports", labelKey: "budget.nav.reports" },
  settings: { route: "/budget/settings", segment: "settings", labelKey: "budget.nav.settings" },
} as const

export type BudgetViewKey = keyof typeof budgetViews

export function budgetViewFromPath(pathname: string): BudgetViewKey {
  const match = Object.entries(budgetViews).find(([, view]) => view.route === pathname)

  return (match?.[0] as BudgetViewKey | undefined) ?? "overview"
}

export function fallbackModules(locale: Locale): AppModule[] {
  return moduleKeys.map((key) => {
    const entry = moduleCatalog[key]

    return {
      id: `local-${key}`,
      key,
      name: entry.name[locale],
      description: entry.description[locale],
      enabled: entry.defaultEnabled,
      active: entry.defaultActive,
    }
  })
}

export function moduleHref(module: Pick<AppModule, "key">) {
  return moduleCatalog[module.key as keyof typeof moduleCatalog]?.route ?? `/${module.key.replaceAll("_", "-")}`
}

export function moduleKeyFromSection(section: string) {
  if (!section) return undefined

  const entry = Object.entries(moduleCatalog).find(([, config]) => config.route === `/${section}`)
  return entry?.[0] ?? section.replaceAll("-", "_")
}

export function moduleName(module: AppModule, locale: Locale) {
  return moduleCatalog[module.key as keyof typeof moduleCatalog]?.name[locale] ?? module.name
}

export function moduleDescription(module: AppModule, locale: Locale) {
  return moduleCatalog[module.key as keyof typeof moduleCatalog]?.description[locale] ?? module.description
}

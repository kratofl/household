import type { Locale, TranslationKey } from "@/lib/i18n"

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

// The Budget module's pages. The monthly budget is the Budget; the sidebar
// lists these four in this order.
export const budgetViews = {
  overview: { route: "/budget", labelKey: "budget.nav.overview" },
  expenses: { route: "/budget/expenses", labelKey: "budget.nav.expenses" },
  plan: { route: "/budget/plan", labelKey: "budget.nav.plan" },
  savings: { route: "/budget/savings", labelKey: "budget.nav.savings" },
} as const satisfies Record<string, BudgetView>

type BudgetView = { route: string; labelKey: TranslationKey }
export type BudgetViewKey = keyof typeof budgetViews
export const budgetViewEntries = Object.entries(budgetViews) as [BudgetViewKey, BudgetView][]

export function budgetViewFromPath(pathname: string): BudgetViewKey {
  const match = budgetViewEntries.find(([, view]) => view.route === pathname)

  return match?.[0] ?? "overview"
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

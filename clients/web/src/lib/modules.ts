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

// Budget has two families of views while the monthly budget is in preview:
// "monthly" is the new flow and the primary navigation; "legacy" is the old
// Budget that stays reachable until the cutover (docs/budget/monthly-budget-preview.md).
export type BudgetViewFamily = "monthly" | "legacy"

export const budgetViews = {
  previewOverview: { route: "/budget/preview", segment: "preview", family: "monthly", labelKey: "budget.nav.preview" },
  previewExpenses: { route: "/budget/preview/expenses", segment: "preview/expenses", family: "monthly", labelKey: "budget.nav.transactions" },
  previewPlan: { route: "/budget/preview/plan", segment: "preview/plan", family: "monthly", labelKey: "budget.nav.planning" },
  previewSavings: { route: "/budget/preview/savings", segment: "preview/savings", family: "monthly", labelKey: "budget.nav.previewSavings" },
  overview: { route: "/budget", segment: "", family: "legacy", labelKey: "budget.nav.overview" },
  transactions: { route: "/budget/transactions", segment: "transactions", family: "legacy", labelKey: "budget.nav.transactions" },
  planning: { route: "/budget/planning", segment: "planning", family: "legacy", labelKey: "budget.nav.planning" },
  saving: { route: "/budget/saving-investing", segment: "saving-investing", family: "legacy", labelKey: "budget.nav.saving" },
  wishlist: { route: "/budget/wishlist", segment: "wishlist", family: "legacy", labelKey: "budget.nav.wishlist" },
  categories: { route: "/budget/categories", segment: "categories", family: "legacy", labelKey: "budget.nav.categories" },
  reports: { route: "/budget/reports", segment: "reports", family: "legacy", labelKey: "budget.nav.reports" },
  settings: { route: "/budget/settings", segment: "settings", family: "legacy", labelKey: "budget.nav.settings" },
} as const satisfies Record<string, { route: string; segment: string; family: BudgetViewFamily; labelKey: string }>

export function budgetViewsFor(family: BudgetViewFamily) {
  return Object.entries(budgetViews).filter(([, view]) => view.family === family)
}

/**
 * Views for the phone segmented control: the family the current path is in.
 * The legacy family also offers the monthly overview as the way across.
 */
export function visibleBudgetViews(pathname: string) {
  const family = budgetViews[budgetViewFromPath(pathname)].family
  const views = budgetViewsFor(family)
  return family === "legacy" ? [...views, ["previewOverview", budgetViews.previewOverview] as const] : views
}

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

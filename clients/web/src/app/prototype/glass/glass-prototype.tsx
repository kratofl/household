"use client"

// PROTOTYPE ONLY. Renders one budget month in three Liquid Glass takes.
// A: macOS 26 Tahoe. Floating inset sidebar, loose floating toolbar capsules,
//    thick lens glass, big radii, monochrome sidebar icons.
// B: macOS 27 Golden Gate. Edge-to-edge sidebar with coloured icons, one
//    uniform toolbar bar, thin stacked sheets, smaller radii.
// C: Household today plus 27 glass only where something floats over content:
//    the sticky action bar, the filter menu and the phone tab bar.

import {
  IconCalendar,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconHome,
  IconMoon,
  IconPigMoney,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconSun,
  IconWallet,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"

import { HouseholdLogo } from "@/components/app/household-logo"
import { PrototypeSwitcher, type PrototypeVariant } from "@/components/app/prototype-switcher"
import { formatters } from "@/features/budget/monthly/controller"
import { categoryVisual } from "@/features/budget/monthly/category-visuals"
import { tileColor } from "@/features/budget/tile-colors"
import { cn } from "@/lib/utils"

import styles from "./glass.module.css"

type VariantKey = "A" | "B" | "C"

const variants: (PrototypeVariant & { key: VariantKey })[] = [
  { key: "A", name: "macOS 26 Tahoe" },
  { key: "B", name: "macOS 27 Golden Gate" },
  { key: "C", name: "Household + 27 glass" },
]

const defaultTint: Record<VariantKey, number> = { A: 0.3, B: 0.55, C: 0.6 }

const fmt = formatters("de", "EUR")

const categories = [
  { name: "Lebensmittel", spent: 41230, budget: 60000 },
  { name: "Tanken", spent: 9600, budget: 18000 },
  { name: "Essen gehen", spent: 13840, budget: 15000 },
  { name: "Freizeit", spent: 6490, budget: 12000 },
  { name: "Drogerie", spent: 3820, budget: 6000 },
  { name: "Haushalt", spent: 21000, budget: 20000 },
]

const expenses = [
  { day: "2026-09-24", merchant: "REWE", category: "Lebensmittel", cents: 5412 },
  { day: "2026-09-24", merchant: "Bäckerei Hofer", category: "Essen gehen", cents: 640 },
  { day: "2026-09-23", merchant: "Aral", category: "Tanken", cents: 7130 },
  { day: "2026-09-23", merchant: "dm", category: "Drogerie", cents: 1845 },
  { day: "2026-09-22", merchant: "IKEA", category: "Haushalt", cents: 12900 },
  { day: "2026-09-21", merchant: "Lieferando", category: "Essen gehen", cents: 2890 },
  { day: "2026-09-21", merchant: "Cineplex", category: "Freizeit", cents: 2400 },
  { day: "2026-09-20", merchant: "Edeka", category: "Lebensmittel", cents: 3380 },
  { day: "2026-09-19", merchant: "OBI", category: "Haushalt", cents: 4720 },
  { day: "2026-09-18", merchant: "Aldi Süd", category: "Lebensmittel", cents: 2615 },
]

const nav = [
  { label: "Übersicht", icon: IconHome, color: "var(--sys-blue)" },
  { label: "Monat", icon: IconWallet, color: "var(--sys-green)", active: true, level: 1 },
  { label: "Ausgaben", icon: IconReceipt, color: "var(--sys-orange)", level: 1 },
  { label: "Plan", icon: IconChartBar, color: "var(--sys-indigo)", level: 1 },
  { label: "Sparen", icon: IconPigMoney, color: "var(--sys-pink)", level: 1 },
  { label: "Einkauf", icon: IconShoppingCart, color: "var(--sys-teal)" },
  { label: "Kalender", icon: IconCalendar, color: "var(--sys-red)" },
  { label: "Einstellungen", icon: IconSettings, color: "var(--sys-gray)" },
]

const recipes: Record<VariantKey, { title: string; lines: string[] }> = {
  A: {
    title: "Ein dicker Glasklotz",
    lines: [
      "fill: weiß × tint × 0.55, sehr klar",
      "backdrop-filter: blur(4px) saturate(1.9)",
      "Lensing: SVG feDisplacementMap am Rand (nur Chromium)",
      "Rand: 1px weiß rundum + Innenglühen oben-links und unten-rechts",
      "Schatten: groß und weich (0 12px 32px)",
      "Radien: Sidebar 26px, Karten 22px, alles Kapseln",
      "Toolbar: lose schwebende Kapseln, kein Balken",
    ],
  },
  B: {
    title: "Dünne Scheiben übereinander",
    lines: [
      "fill: weiß × tint, deckender",
      "backdrop-filter: blur(24px) saturate(1.6), kein Lensing",
      "Dunkle Kante: box-shadow 0 0 0 0.5px schwarz/16%",
      "Glanz: 1px-Ring per mask, nur auf Flächen, nicht auf Buttons",
      "Scheibe auf Scheibe: nur Fill + Kante, kein zweiter Blur",
      "Schatten: kurz (0 1px 2px), Tiefe kommt aus den Kanten",
      "Radien: Karten 12px, Sidebar bündig am Rand",
    ],
  },
  C: {
    title: "27-Glas nur auf schwebenden Ebenen",
    lines: [
      "Chrome bleibt deckend (heutiges .glass, bg-background)",
      "Glas nur über Inhalt: Aktionsleiste (sticky), Menü, Tab-Bar",
      "Material identisch mit B: Blur 24px, dunkle Kante, Glanz oben",
      "Eine Glasleiste, Buttons flach ohne Kante, Schatten oder Glanz",
      "Push-Buttons wie im Kit: Rechteck mit rounded-md, Grau aus --fill-3, Akzent voll",
      "In der Kapsel-Leiste bleiben Buttons Kapseln, damit die Ecken konzentrisch sind",
      "Slider entspricht dem bestehenden --glass-opacity",
    ],
  },
}

export function GlassPrototype({ variant }: { variant: string }) {
  const key: VariantKey = variant === "A" || variant === "C" ? variant : "B"
  const [tints, setTints] = useState(defaultTint)
  const [recipeOpen, setRecipeOpen] = useState(true)
  const tint = tints[key]
  const rootRef = useRef<HTMLDivElement>(null)
  const lens = useSyncExternalStore(
    noopSubscribe,
    () => /Chrome\//.test(navigator.userAgent),
    () => false,
  )
  const { resolvedTheme, setTheme } = useTheme()

  // A CSS custom property, set directly so React's style typing stays honest.
  useLayoutEffect(() => {
    rootRef.current?.style.setProperty("--tint", String(tint))
  }, [tint])

  return (
    <div ref={rootRef} className={cn(styles.root, lens && styles.lens, "fixed inset-0 overflow-hidden text-foreground")}>
      <LensFilter />
      {key === "A" ? <VariantA /> : key === "B" ? <VariantB /> : <VariantC />}

      {recipeOpen ? <RecipePanel variant={key} tint={tint} lens={lens} /> : null}

      <Suspense>
        <PrototypeSwitcher variants={variants} current={key}>
          <label className="flex items-center gap-2 text-white/70">
            <span className="hidden sm:inline">Klar</span>
            <input
              type="range"
              min={0.1}
              max={0.95}
              step={0.01}
              value={tint}
              onChange={(event) => setTints((current) => ({ ...current, [key]: Number(event.target.value) }))}
              aria-label="Glas: klar bis getönt"
              className="w-24 accent-white"
            />
            <span className="hidden sm:inline">Getönt</span>
          </label>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Hell oder dunkel"
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/15"
          >
            {/* CSS decides, so server and client markup agree before the theme is known. */}
            <IconSun className="hidden size-4 dark:block" />
            <IconMoon className="size-4 dark:hidden" />
          </button>
          <button
            type="button"
            onClick={() => setRecipeOpen((open) => !open)}
            aria-pressed={recipeOpen}
            className="rounded-full px-2.5 py-1 hover:bg-white/15 aria-pressed:bg-white/20"
          >
            Rezept
          </button>
        </PrototypeSwitcher>
      </Suspense>
    </div>
  )
}

function noopSubscribe() {
  return () => {}
}

/*
  Tahoe's edge refraction. The displacement map is neutral grey in the middle
  and ramps at the edges, so only the outer ~8% of a surface bends what is
  behind it, pulling the backdrop inward like the rim of a lens.
*/
function LensFilter() {
  const ramp = (axis: "x" | "y", channel: string) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='${axis === "x" ? 1 : 0}' y2='${axis === "y" ? 1 : 0}'><stop offset='0' stop-color='${channel}' stop-opacity='1'/><stop offset='0.08' stop-color='${channel}' stop-opacity='0.5'/><stop offset='0.92' stop-color='${channel}' stop-opacity='0.5'/><stop offset='1' stop-color='${channel}' stop-opacity='0'/></linearGradient></defs><rect width='100' height='100' fill='black'/><rect width='100' height='100' fill='url(#g)'/></svg>`,
    )}`

  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="lens26" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={ramp("x", "#f00")} preserveAspectRatio="none" result="rx" />
        <feImage href={ramp("y", "#0f0")} preserveAspectRatio="none" result="ry" />
        <feComposite in="rx" in2="ry" operator="arithmetic" k2="1" k3="1" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

/* ---------------- Variant A: macOS 26 Tahoe ---------------- */

function VariantA() {
  return (
    <div className={cn(styles.backdrop, "absolute inset-0")}>
      <div className="absolute inset-0 overflow-y-auto px-4 pt-24 pb-40 lg:pr-6 lg:pl-[18rem]">
        <MonthContent radius="rounded-[22px]" controls={<ControlsA />} />
      </div>

      <aside className={cn(styles.g26, "absolute top-3 bottom-3 left-3 hidden w-64 flex-col rounded-[26px] p-3 lg:flex")}>
        <Brand />
        <nav className="mt-4 space-y-0.5">
          {nav.map((item) => (
            <NavRow key={item.label} item={item} activeClass="rounded-full bg-fill-2 font-semibold" iconClass="text-foreground/70" />
          ))}
        </nav>
      </aside>

      <header className="pointer-events-none absolute top-3 right-4 left-4 flex items-center gap-2 lg:right-6 lg:left-[18rem]">
        <div className={cn(styles.btn26, "pointer-events-auto flex rounded-full p-0.5")}>
          <IconButton className="rounded-full" label="Vorheriger Monat"><IconChevronLeft /></IconButton>
          <IconButton className="rounded-full" label="Nächster Monat"><IconChevronRight /></IconButton>
        </div>
        <span className="pointer-events-auto text-[15px] font-semibold drop-shadow-[0_1px_1px_rgb(255_255_255/0.6)]">September 2026</span>
        <div className="flex-1" />
        <IconButton className={cn(styles.btn26, "pointer-events-auto hidden rounded-full sm:inline-flex")} label="Suchen"><IconSearch /></IconButton>
        <Segmented material="26" />
        <button type="button" className={cn(styles.primary26, styles.pressable, "pointer-events-auto flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold")}>
          <IconPlus className="size-4" /> Ausgabe
        </button>
      </header>

      <TabBar material="26" />
    </div>
  )
}

function ControlsA() {
  return (
    <>
      <button type="button" className={cn(styles.primary26, styles.pressable, "h-9 rounded-full px-4 font-semibold")}>Speichern</button>
      <button type="button" className={cn(styles.btn26, styles.pressable, "h-9 rounded-full px-4 font-medium")}>Abbrechen</button>
      <IconButton className={cn(styles.btn26, "rounded-full")} label="Filter"><IconFilter /></IconButton>
      <Segmented material="26" />
    </>
  )
}

/* ---------------- Variant B: macOS 27 Golden Gate ---------------- */

function VariantB() {
  return (
    <div className={cn(styles.backdrop, "absolute inset-0 flex")}>
      <aside className={cn(styles.sidebar27, "hidden w-60 shrink-0 flex-col px-2.5 pt-3 lg:flex")}>
        <Brand />
        <nav className="mt-4 space-y-px">
          {nav.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              activeClass={cn(styles.sheet, "rounded-lg font-semibold")}
              iconClass=""
              colored
            />
          ))}
        </nav>
      </aside>

      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto px-4 pt-[4.5rem] pb-40 lg:px-6">
          <MonthContent radius="rounded-xl" controls={<ControlsB />} />
        </div>

        <header className={cn(styles.toolbar27, "absolute inset-x-0 top-0 flex h-13 items-center gap-2 px-3 lg:px-4")}>
          <div className={cn(styles.sheet, "flex rounded-full")}>
            <IconButton className="rounded-full" label="Vorheriger Monat"><IconChevronLeft /></IconButton>
            <div className="my-2 w-px bg-hairline" />
            <IconButton className="rounded-full" label="Nächster Monat"><IconChevronRight /></IconButton>
          </div>
          <span className="text-[15px] font-semibold">September 2026</span>
          <div className="flex-1" />
          <IconButton className={cn(styles.sheet, "hidden rounded-full sm:inline-flex")} label="Suchen"><IconSearch /></IconButton>
          <Segmented material="27" />
          <button type="button" className={cn(styles.primary27, styles.pressable, "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold")}>
            <IconPlus className="size-4" /> Ausgabe
          </button>
        </header>
      </div>

      <TabBar material="27" />
    </div>
  )
}

function ControlsB() {
  return (
    <>
      <button type="button" className={cn(styles.primary27, styles.pressable, "h-8 rounded-md px-4 font-semibold")}>Speichern</button>
      <button type="button" className={cn(styles.btn27, styles.pressable, "h-8 rounded-md px-4 font-medium")}>Abbrechen</button>
      <IconButton className={cn(styles.btn27, "rounded-md")} label="Filter"><IconFilter /></IconButton>
      <Segmented material="27" />
    </>
  )
}

/* ---------------- Variant C: Household + 27 glass on floating layers ---------------- */

function VariantC() {
  const [menuOpen, setMenuOpen] = useState(true)

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <header className="glass flex h-14 shrink-0 items-center gap-2.5 px-4 lg:pl-[18px]">
        <HouseholdLogo className="size-8" />
        <span className="text-[19px] leading-none font-bold tracking-[-0.03em]">Household</span>
        <span className="ml-6 hidden text-[15px] text-muted-foreground sm:inline">Budget</span>
        <span className="text-[15px] font-medium">Monat</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col bg-sidebar px-2.5 pt-3 lg:flex">
          <nav className="space-y-0.5">
            {nav.map((item) => (
              <NavRow
                key={item.label}
                item={item}
                activeClass="rounded-xl bg-sidebar-accent font-semibold [&_svg]:text-primary"
                iconClass="text-muted-foreground"
              />
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-canvas px-4 pt-3 pb-40 lg:rounded-tl-3xl lg:px-6">
          <div className="sticky top-0 z-10 flex justify-end pb-4">
            {/* One glass bar. The controls inside are plain, so there is no second pill. */}
            <div className={cn(styles.g27, "flex items-center gap-1 rounded-full p-1")}>
              <IconButton className="rounded-full hover:bg-fill-3" label="Vorheriger Monat"><IconChevronLeft /></IconButton>
              <span className="px-1 text-[13px] font-semibold">September</span>
              <IconButton className="rounded-full hover:bg-fill-3" label="Nächster Monat"><IconChevronRight /></IconButton>
              <div className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
              <Segmented material="27" />
              <div className="relative">
                <IconButton
                  className="rounded-full hover:bg-fill-3 aria-pressed:bg-fill-3"
                  label="Filter"
                  pressed={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <IconFilter />
                </IconButton>
                {menuOpen ? <FilterMenu /> : null}
              </div>
              <button type="button" className={cn(styles.primary27, styles.pressable, "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold")}>
                <IconPlus className="size-4" /> Ausgabe
              </button>
            </div>
          </div>
          <MonthContent radius="rounded-[14px]" controls={<ControlsB />} />
        </main>
      </div>
      <TabBar material="27" />
    </div>
  )
}

function FilterMenu() {
  const items = ["Alle Kategorien", "Lebensmittel", "Tanken", "Essen gehen", "Haushalt"]
  return (
    <div role="menu" className={cn(styles.g27, "absolute top-[calc(100%+10px)] right-0 w-52 rounded-[14px] p-1.5")}>
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          role="menuitem"
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px]",
            index === 0 ? "bg-primary font-medium text-primary-foreground" : "hover:bg-fill-3",
          )}
        >
          {index > 0 ? <span className="size-2 rounded-full" style={{ background: tileColor(item) }} /> : null}
          {item}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Shared content ---------------- */

/** The budget month itself. Content, not chrome, so it stays opaque in every variant. */
function MonthContent({ radius, controls }: { radius: string; controls: ReactNode }) {
  const budget = categories.reduce((sum, category) => sum + category.budget, 0)
  const spent = categories.reduce((sum, category) => sum + category.spent, 0)
  const days = [...new Set(expenses.map((expense) => expense.day))]

  return (
    <div className="space-y-5">
      <section
        className={cn(radius, "relative overflow-hidden p-6 text-white")}
        style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--sys-pink)))" }}
      >
        <div className="text-[13px] font-medium opacity-85">Verfügbar im September</div>
        <div className="mt-1 text-[40px] leading-none font-bold tracking-[-0.03em]">{fmt.money(budget - spent)}</div>
        <div className="mt-2 text-[13px] opacity-85">
          {fmt.money(spent)} von {fmt.money(budget)} ausgegeben, noch 6 Tage
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${(spent / budget) * 100}%` }} />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2.5">
        <span className="mr-2 text-[12px] font-medium text-muted-foreground">Bedienelemente auf dem Hintergrund</span>
        {controls}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {categories.map((category) => {
          const visual = categoryVisual(category.name)
          const Icon = visual.icon
          const over = category.spent > category.budget
          return (
            <div key={category.name} className={cn("surface-group p-4", radius)}>
              <div className="flex items-center gap-2.5">
                <span className="icon-tile size-8 text-white" style={{ background: visual.color }}>
                  <Icon className="size-4.5" />
                </span>
                <span className="font-semibold">{category.name}</span>
              </div>
              <div className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">{fmt.money(category.spent)}</div>
              <div className={cn("text-[12px]", over ? "text-sys-red" : "text-muted-foreground")}>
                von {fmt.money(category.budget)}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (category.spent / category.budget) * 100)}%`, background: over ? "var(--sys-red)" : visual.color }}
                />
              </div>
            </div>
          )
        })}
      </section>

      {days.map((day) => (
        <section key={day}>
          <h3 className="mb-1.5 px-1 text-[12px] font-medium text-muted-foreground">{fmt.day(day)}</h3>
          <div className={cn("surface-group hairline-rows overflow-hidden", radius)}>
            {expenses
              .filter((expense) => expense.day === day)
              .map((expense) => (
                <div key={expense.merchant} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
                    style={{ background: tileColor(expense.merchant) }}
                  >
                    {expense.merchant.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{expense.merchant}</div>
                    <div className="text-[12px] text-muted-foreground">{expense.category}</div>
                  </div>
                  <span className="font-semibold tabular-nums">{fmt.money(expense.cents)}</span>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2 pt-1">
      <HouseholdLogo className="size-7" />
      <span className="text-[17px] font-bold tracking-[-0.03em]">Household</span>
    </div>
  )
}

function NavRow({
  item,
  activeClass,
  iconClass,
  colored = false,
}: {
  item: (typeof nav)[number]
  activeClass: string
  iconClass: string
  colored?: boolean
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 text-left text-sm",
        item.level === 1 ? "min-h-8 pr-3 pl-7 text-[13px]" : "min-h-9 px-3",
        item.active ? activeClass : "rounded-lg hover:bg-fill-3",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", iconClass)} style={colored ? { color: item.color } : undefined} />
      {item.label}
    </button>
  )
}

function IconButton({
  label,
  className,
  children,
  pressed,
  onClick,
}: {
  label: string
  className?: string
  children: ReactNode
  pressed?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(styles.pressable, "inline-flex size-8 items-center justify-center [&_svg]:size-[18px]", className)}
    >
      {children}
    </button>
  )
}

const periods = ["Woche", "Monat", "Jahr"]

/**
 * Segments are equal width, so the selected bubble is one absolutely placed
 * thumb that slides by whole segments. No measuring, and the slide is a single
 * transform transition that follows the panel motion setting.
 */
function Segmented({ material }: { material: "26" | "27" }) {
  const [value, setValue] = useState("Monat")
  const index = periods.indexOf(value)
  // 27 always uses the recessed track, in a bar and on its own over content.
  const track = material === "26" ? cn(styles.btn26, "pointer-events-auto") : styles.well27
  const thumb = material === "26" ? styles.thumb26 : styles.thumb27
  return (
    <div role="radiogroup" aria-label="Zeitraum" className={cn(track, "relative hidden grid-cols-3 rounded-full p-[3px] sm:grid")}>
      <span
        aria-hidden
        className={cn(thumb, styles.slide, "absolute inset-y-[3px] left-[3px] rounded-full")}
        style={{ width: `calc((100% - 6px) / ${periods.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {periods.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => setValue(option)}
          className={cn(
            "relative h-7 rounded-full px-3 text-[12px] font-medium transition-colors",
            value === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

/** The phone tab bar, in either material. Hidden on desktop, like the real one. */
function TabBar({ material }: { material: "26" | "27" }) {
  const items = nav.filter((item) => !item.level).slice(0, 4)
  return (
    <nav className={cn(material === "26" ? styles.g26 : styles.g27, "fixed inset-x-4 bottom-20 z-20 mx-auto flex w-fit items-center gap-0.5 rounded-full p-1 lg:hidden")}>
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            className={cn(
              "flex w-[68px] flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px]",
              index === 0 ? cn(material === "26" ? styles.thumb26 : styles.thumb27, "text-primary") : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

/* ---------------- Recipe panel (prototype chrome, not part of the design) ---------------- */

function RecipePanel({ variant, tint, lens }: { variant: VariantKey; tint: number; lens: boolean }) {
  const recipe = recipes[variant]
  return (
    <aside className="fixed right-4 bottom-20 z-40 hidden w-80 rounded-2xl bg-black/85 p-4 text-[12px] text-white shadow-[0_8px_30px_rgb(0_0_0/0.35)] ring-1 ring-white/15 md:block">
      <div className="text-[11px] tracking-wide text-white/50 uppercase">Rezept {variant}</div>
      <div className="mt-0.5 text-[14px] font-semibold">{recipe.title}</div>
      {variant === "C" ? null : <Anatomy variant={variant} />}
      <ul className="mt-3 space-y-1.5 text-white/80">
        {recipe.lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-white/35">·</span>
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-white/15 pt-2 font-mono text-[11px] text-white/55">
        --tint: {tint.toFixed(2)}
        {variant === "A" ? ` · lensing ${lens ? "an" : "aus (kein Chromium)"}` : ""}
      </div>
    </aside>
  )
}

/** Side view of the material: one thick lens for 26, three offset thin sheets for 27. */
function Anatomy({ variant }: { variant: "A" | "B" }) {
  return (
    <div
      className="relative mt-3 h-24 overflow-hidden rounded-xl"
      style={{ background: "linear-gradient(120deg, #ff6a00, #af52de 55%, #30b0c7)" }}
    >
      {variant === "A" ? (
        <div className={cn(styles.anatomyLens, "absolute inset-x-8 inset-y-5 rounded-full")} />
      ) : (
        <>
          <div className={cn(styles.anatomySheet, "top-4 left-6 h-14 w-44 rounded-xl")} />
          <div className={cn(styles.anatomySheet, "top-7 left-14 h-10 w-36 rounded-lg")} />
          <div className={cn(styles.anatomySheet, "top-10 left-22 h-6 w-24 rounded-md")} />
        </>
      )}
    </div>
  )
}

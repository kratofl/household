"use client"

// PROTOTYPE ONLY. Sample props for the shared redesign building blocks; the
// numbers are the overview prototype's (.plans/overview-redesign) in cents.
// German copy is hard-coded on purpose: this page is never shipped.

import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconFilter,
  IconGasStation,
  IconPigMoney,
  IconPlus,
  IconShare,
  IconShield,
  IconShoppingCart,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { useState } from "react"

import { BreakdownChart, DailyBarChart, PaceChart, PeriodTrendChart } from "@/components/app/charts"
import { SearchField } from "@/components/app/global-search"
import { Group, Row } from "@/components/app/grouped"
import { HeroMetric } from "@/components/app/hero-metric"
import { MetricStrip } from "@/components/app/metric-strip"
import { PageHeader } from "@/components/app/page-header"
import { PeriodStepper } from "@/components/app/period-stepper"
import { ToolbarButton, ToolbarFrame, ToolbarGroup } from "@/components/app/toolbar"
import { Button } from "@/components/ui/button"
import { translate, type TranslationKey } from "@/lib/i18n"

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
const whole = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const formatMoney = (cents: number) => money.format(cents / 100)
const formatTick = (cents: number) => whole.format(cents / 100)
const t = (key: TranslationKey, values?: Record<string, string | number>) => translate("de", key, values)

const weekday = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
const dayLabel = (day: number) => `${weekday[new Date(2026, 9, day).getDay()]}, ${day}. Okt`
const tickLabel = (day: number) => (day === 1 ? "1. Okt" : `${day}.`)

const DAYS = 31
const TODAY = 11
const BUDGET = 70203
const daily = [1950, 8990, 3140, 6130, 4599, 6850, 6151, 1240, 7105, 2400, 5420]
const funCumulative = [0, 8990, 11290, 11290, 15889, 22739, 25000, 26240, 26240, 28640, 28640]
const months = ["Okt 2026", "Nov 2026", "Dez 2026", "Jan 2027"]

const trend = [
  { label: "Mai", spent: 64010, budget: BUDGET, running: false },
  { label: "Jun", spent: 73140, budget: BUDGET, running: false },
  { label: "Jul", spent: 59025, budget: BUDGET, running: false },
  { label: "Aug", spent: 66880, budget: BUDGET, running: false },
  { label: "Sep", spent: 65530, budget: BUDGET, running: false },
  { label: "Okt", spent: 28640, budget: BUDGET, running: true },
]
const trendLabels = { title: "Spaßbudget der letzten 6 Perioden", spent: "Ausgegeben", budget: "Budget", running: "läuft", overBudget: "Über Budget", leftOver: "Übrig" }

export function RedesignKit() {
  const { resolvedTheme, setTheme } = useTheme()
  const [month, setMonth] = useState(0)
  const search = <SearchField destinations={[]} t={t} />
  const stepper = (
    <PeriodStepper
      label={months[month] ?? ""}
      onPrevious={() => setMonth((value) => value - 1)}
      onNext={() => setMonth((value) => value + 1)}
      previousDisabled={month === 0}
      nextDisabled={month === months.length - 1}
      previousLabel="Vorherige Periode"
      nextLabel="Nächste Periode"
    />
  )
  const icons = (
    <ToolbarGroup>
      <ToolbarButton label="Filter" icon={<IconFilter />} onClick={() => {}} />
      <ToolbarButton label="Teilen" icon={<IconShare />} onClick={() => {}} />
    </ToolbarGroup>
  )
  const primary = { label: "Ausgabe erfassen", icon: <IconPlus />, onClick: () => {} }

  return (
    <div className="min-h-screen space-y-6 bg-bg p-5 text-label">
      <div className="flex items-center gap-3">
        <h1 className="text-title-1">Redesign kit</h1>
        <Button variant="secondary" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          Hell / Dunkel
        </Button>
      </div>

      <h2 className="text-headline">Toolbar at 800px content (1024px window with sidebar)</h2>
      <div className="w-[800px] max-w-full overflow-hidden rounded-lg border border-separator">
        <ToolbarFrame search={search}>
          <PageHeader title="Übersicht" scope={stepper} caption="1.–31. Okt · Tag 11 von 31" actions={icons} primaryAction={primary} />
        </ToolbarFrame>
      </div>
      <h2 className="text-headline">Toolbar, long title, full width</h2>
      <div className="overflow-hidden rounded-lg border border-separator">
        <ToolbarFrame search={search}>
          <PageHeader title="Einkommen & Rücklagen" scope={stepper} caption="1.–31. Okt · Tag 11 von 31" primaryAction={primary} />
        </ToolbarFrame>
      </div>
      <h2 className="text-headline">Toolbar, title + subtitle only (settings)</h2>
      <div className="overflow-hidden rounded-lg border border-separator">
        <ToolbarFrame search={search}>
          <div className="p-4">
            <PageHeader title="Einstellungen" subtitle="Sprache und Darstellung." />
          </div>
        </ToolbarFrame>
      </div>

      <h2 className="text-headline">Overview (D)</h2>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-stretch">
        <HeroMetric
          label="Spaßbudget übrig"
          value={formatMoney(BUDGET - 28640)}
          supporting={
            <>
              von {formatMoney(BUDGET)} · noch 20 Tage · <strong>20,78 € pro Tag</strong>
            </>
          }
          status={{ label: "37,24 € über Plan", icon: IconAlertTriangle }}
        >
          <PaceChart
            days={DAYS}
            today={TODAY}
            cumulative={funCumulative}
            budget={BUDGET}
            formatMoney={formatMoney}
            formatTick={formatTick}
            dayLabel={dayLabel}
            tickLabel={tickLabel}
            labels={{ title: "Spaßbudget im Oktober, Tag für Tag", today: "Heute", plan: "Plan", spent: "Ausgegeben" }}
          />
        </HeroMetric>
        <Group title="Anstehend" action={{ label: "Alle Abos", href: "#" }}>
          {["Fitnessstudio", "Spotify", "Netflix", "ADAC", "iCloud+"].map((name) => (
            <Row key={name}>
              <span className="font-medium">{name}</span>
            </Row>
          ))}
        </Group>
      </div>

      <MetricStrip
        title="Töpfe"
        action={{ label: "Verwalten", href: "#" }}
        cells={[
          { label: "Lebensmittel", value: "267,70 €", icon: { glyph: IconShoppingCart, tone: "green" }, note: "übrig von 450,00 €", meter: { fraction: 0.405, marker: TODAY / DAYS, label: "40 % verbraucht" } },
          { label: "Tanken", value: "−21,05 €", negative: true, icon: { glyph: IconGasStation, tone: "blue" }, note: "über 150,00 €", meter: { fraction: 1, marker: TODAY / DAYS } },
          { label: "Erspartes", value: "1.987,50 €", icon: { glyph: IconPigMoney, tone: "purple" }, note: <><strong className="text-success-text">+400,00 €</strong> diese Periode</> },
          { label: "Puffer", value: "600,00 €", icon: { glyph: IconShield, tone: "yellow" }, note: "geschützt · nur auf Ansage" },
          { label: "Nächste Periode", value: "702,03 €", icon: { glyph: IconCalendarEvent, tone: "blue" }, note: "Spaßbudget ab 1. Nov" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Group title="Spaßbudget der letzten 6 Perioden">
          <div className="px-2 pt-2 pb-1.5">
            <PeriodTrendChart periods={trend} formatMoney={formatMoney} formatTick={formatTick} labels={trendLabels} />
          </div>
        </Group>
        <Group title="Budgets, die sich ändern">
          <div className="px-2 pt-2 pb-1.5">
            <PeriodTrendChart
              periods={trend.map((period, index) => ({ ...period, budget: index < 3 ? 65000 : BUDGET, spent: index === 5 ? 74000 : period.spent }))}
              formatMoney={formatMoney}
              formatTick={formatTick}
              labels={trendLabels}
            />
          </div>
        </Group>
      </div>

      <h2 className="text-headline">List (B)</h2>
      <MetricStrip
        cells={[
          { label: "Spaßbudget übrig", value: "415,63 €", note: "20,78 € pro Tag · 20 Tage", meter: { fraction: 0.41, marker: TODAY / DAYS } },
          { label: "Ausgegeben", value: "539,75 €", note: "13 Ausgaben seit 1. Okt" },
          { label: "Verfügbares Erspartes", value: "1.987,50 €", note: <><strong className="text-success-text">+400,00 €</strong> diese Periode</> },
        ]}
      />
      <Group title="Ausgaben pro Tag">
        <div className="px-2 pt-2 pb-1.5">
          <DailyBarChart
            days={DAYS}
            today={TODAY}
            amounts={daily}
            formatMoney={formatMoney}
            formatTick={formatTick}
            dayLabel={dayLabel}
            tickLabel={tickLabel}
            details={(day) => (day === 7 ? [{ label: "Edeka", value: "38,90 €" }, { label: "Thalia", value: "22,61 €" }] : [])}
            labels={{ title: "Ausgaben pro Tag im Oktober", today: "Heute", spent: "Ausgegeben", open: "noch offen" }}
          />
        </div>
      </Group>

      <h2 className="text-headline">Plan (C)</h2>
      <Group title="Wohin deine 3.200,00 € im Oktober gehen" action={{ label: "Plan bearbeiten", href: "#" }}>
        <div className="px-4 py-1.5">
          <BreakdownChart
            title="Wohin deine 3.200,00 € im Oktober gehen"
            whole={{ label: "Einkommen", amount: 320000 }}
            deductions={[
              { label: "Fixkosten", amount: 124000 },
              { label: "Abos", amount: 15797 },
              { label: "Reservierte Kategorien", amount: 60000 },
              { label: "Sparen", amount: 40000 },
              { label: "Puffer", amount: 10000 },
            ]}
            remainder={{ label: "Spaßbudget", amount: BUDGET }}
            formatMoney={formatMoney}
          />
        </div>
      </Group>
      <Group title="Überplant">
        <div className="px-4 py-1.5">
          <BreakdownChart
            title="Überplant"
            whole={{ label: "Einkommen", amount: 200000 }}
            deductions={[
              { label: "Fixkosten", amount: 180000 },
              { label: "Sparen", amount: 40000 },
            ]}
            remainder={{ label: "Spaßbudget", amount: -20000 }}
            formatMoney={formatMoney}
          />
        </div>
      </Group>
    </div>
  )
}

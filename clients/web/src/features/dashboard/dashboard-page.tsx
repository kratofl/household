"use client"

// The global dashboard: one widget board fed by every active module. Budget is
// the only module with widgets today; the board itself does not know that.

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { boardElements } from "@/components/app/board-elements"
import { WidgetBoard, type WidgetDefinition } from "@/components/app/widget-board"
import { budgetDashboardWidgets, budgetWidgets } from "@/features/budget/monthly/widgets"
import { useMonthlyBudget } from "@/features/budget/monthly/controller"
import type { Locale, Translator } from "@/lib/i18n"
import type { AppModule } from "@/lib/modules"

export function DashboardPage({
  accessToken,
  modules,
  locale,
  t,
}: {
  accessToken?: string
  modules: AppModule[]
  locale: Locale
  t: Translator
}) {
  const budgetActive = modules.some((module) => module.key === "budget")
  const budget = useMonthlyBudget(budgetActive ? accessToken : undefined, locale)

  if (modules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.noActiveSlicesTitle")}</CardTitle>
          <CardDescription>{t("dashboard.noActiveSlicesDescription")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (budgetActive && budget.resource.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("error.title")}</AlertTitle>
        <AlertDescription>{budget.resource.message}</AlertDescription>
      </Alert>
    )
  }

  const moduleWidgets: WidgetDefinition[] =
    budgetActive && budget.resource.status === "ready" && budget.presentation
      ? budgetWidgets({
          state: budget.resource.data,
          view: budget.presentation,
          copy: budget.copy,
          locale,
          busy: budget.busy,
        })
      : []
  const widgets = [...boardElements(t), ...moduleWidgets]

  if (moduleWidgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.budgetCardTitle")}</CardTitle>
          <CardDescription>{t("dashboard.sliceUnavailable")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <WidgetBoard boardId="dashboard" widgets={widgets} defaultIds={budgetDashboardWidgets} t={t} />
}

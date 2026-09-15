"use client"

// Routes an active module to its panel. Budget has the legacy panel and the monthly preview.

import type { Locale, Translator } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MonthlyBudget } from "@/features/budget/monthly/monthly-budget"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

import { BudgetPanel } from "@/features/budget/legacy/budget-panel"

export function DashboardPanel(props: {
  accessToken?: string
  locale: Locale
  pathname: string
  selectedModule: AppModule
  t: Translator
}) {
  return (
    <div className="space-y-5">
      {props.selectedModule.key === "budget" ? (
        props.pathname === "/budget/preview" || props.pathname.startsWith("/budget/preview/") ? (
          <MonthlyBudget accessToken={props.accessToken} locale={props.locale} pathname={props.pathname} />
        ) : <BudgetPanel accessToken={props.accessToken} locale={props.locale} pathname={props.pathname} t={props.t} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{moduleName(props.selectedModule, props.locale)}</CardTitle>
            <CardDescription>{moduleDescription(props.selectedModule, props.locale)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              {props.t("dashboard.sliceUnavailable")}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

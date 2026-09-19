"use client"

// Routes an active module to its panel.

import type { Locale, Translator } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MonthlyBudget } from "@/features/budget/monthly/monthly-budget"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

export function DashboardPanel(props: {
  accessToken?: string
  locale: Locale
  pathname: string
  selectedModule: AppModule
  isAdmin?: boolean
  t: Translator
}) {
  return (
    <div className="space-y-5">
      {props.selectedModule.key === "budget" ? (
        <MonthlyBudget accessToken={props.accessToken} locale={props.locale} pathname={props.pathname} isAdmin={props.isAdmin} t={props.t} />
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

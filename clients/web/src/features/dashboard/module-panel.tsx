"use client"

// Routes an active module to its panel.

import type { Locale, Translator } from "@/lib/i18n"
import { ToolbarContent } from "@/components/app/toolbar"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="space-y-6">
      {props.selectedModule.key === "budget" ? (
        <MonthlyBudget accessToken={props.accessToken} locale={props.locale} pathname={props.pathname} isAdmin={props.isAdmin} t={props.t} />
      ) : (
        <>
          <ToolbarContent title={moduleName(props.selectedModule, props.locale)} />
          <Card>
            <CardHeader>
              <CardTitle>{moduleDescription(props.selectedModule, props.locale)}</CardTitle>
              <CardDescription>{props.t("dashboard.sliceUnavailable")}</CardDescription>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  )
}

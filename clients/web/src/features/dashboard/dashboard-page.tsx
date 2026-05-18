"use client"

import { IconWallet } from "@tabler/icons-react"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { loadBudgetSummary } from "@/features/budget/api"
import type { BudgetSummary } from "@/features/budget/types"
import type { Locale, translate } from "@/lib/i18n"
import type { AppModule } from "@/lib/modules"

type Translator = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => string

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
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [loadingBudget, setLoadingBudget] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const budgetModule = modules.find((module) => module.key === "budget")

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [locale],
  )

  useEffect(() => {
    if (!accessToken || !budgetModule) {
      return
    }

    let active = true
    void loadBudgetSummary(accessToken)
      .then((summary) => {
        if (!active) return
        setBudgetSummary(summary)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : t("error.unexpected"))
      })
      .finally(() => {
        if (active) setLoadingBudget(false)
      })

    return () => {
      active = false
    }
  }, [accessToken, budgetModule, t])

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

  return (
    <div className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h3 className="text-xl font-semibold tracking-tight">{t("dashboard.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("dashboard.description")}</p>
      </div>

      {budgetModule ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t("dashboard.budgetCardTitle")}</CardTitle>
                <CardDescription>{t("dashboard.budgetCardDescription")}</CardDescription>
              </div>
              <IconWallet className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingBudget && !budgetSummary ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : budgetSummary ? (
              <div className="grid gap-4 md:grid-cols-4">
                <DashboardMetric label={t("budget.monthlyLimit")} value={currency.format(budgetSummary.period.spendingLimitCents / 100)} />
                <DashboardMetric label={t("budget.spent")} value={currency.format(budgetSummary.spentInLimitCents / 100)} />
                <DashboardMetric label={t("budget.remaining")} value={currency.format(budgetSummary.remainingCents / 100)} />
                <DashboardMetric label={t("budget.accountBalance")} value={currency.format(budgetSummary.accountBalanceCents / 100)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dashboard.sliceUnavailable")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

    </div>
  )
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

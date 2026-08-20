"use client"

import { useEffect, useMemo, useState } from "react"

import { HeroMetric, InlineStat, meterTone } from "@/components/app/metrics"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
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

      {budgetModule ? (
        loadingBudget && !budgetSummary ? (
          <Skeleton className="h-40" />
        ) : budgetSummary ? (
          <HeroMetric
            eyebrow={t("dashboard.budgetCardTitle")}
            label={t("budget.heroAvailable")}
            value={currency.format(budgetSummary.remainingCents / 100)}
            tone={
              budgetSummary.remainingCents < 0
                ? "critical"
                : meterTone(spentFraction(budgetSummary))
            }
            usedFraction={spentFraction(budgetSummary)}
            caption={t("budget.heroUsage", {
              spent: currency.format(budgetSummary.spentInLimitCents / 100),
              limit: currency.format(budgetSummary.period.spendingLimitCents / 100),
            })}
            stats={
              <>
                <InlineStat
                  label={t("budget.monthlyLimit")}
                  value={currency.format(budgetSummary.period.spendingLimitCents / 100)}
                />
                <InlineStat
                  label={t("budget.spent")}
                  value={currency.format(budgetSummary.spentInLimitCents / 100)}
                />
                <InlineStat
                  label={t("budget.accountBalance")}
                  value={currency.format(budgetSummary.accountBalanceCents / 100)}
                />
              </>
            }
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.budgetCardTitle")}</CardTitle>
              <CardDescription>{t("dashboard.sliceUnavailable")}</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

    </div>
  )
}

function spentFraction(summary: BudgetSummary) {
  if (summary.period.spendingLimitCents <= 0) return summary.spentInLimitCents > 0 ? 1 : 0
  return summary.spentInLimitCents / summary.period.spendingLimitCents
}

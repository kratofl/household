"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  IconCalendar,
  IconChartBar,
  IconChefHat,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconCloudDownload,
  IconDeviceDesktop,
  IconLanguage,
  IconLogin2,
  IconLogout,
  IconMoon,
  IconRecycle,
  IconRefresh,
  IconSettings,
  IconShoppingCart,
  IconSun,
  IconUserCheck,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FormSelect } from "@/components/app/form-select"
import {
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsSurface,
} from "@/components/app/settings-surface"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  applyCurrentPlannedExpenses,
  createBudgetCategory,
  createBudgetLedgerEntry,
  correctBudgetLedgerEntry,
  createPlannedExpense as createPlannedExpenseRequest,
  loadBudgetSummary,
  loadBudgetSetup,
  loadBudgetLedgerDetails,
  loadBudgetTimeline,
  refundBudgetLedgerEntry,
  saveBudgetSetup,
  updateBudgetCategory,
  updateCurrentBudgetPeriod,
  updateBudgetSettings,
  updatePlannedExpense as updatePlannedExpenseRequest,
  voidBudgetLedgerEntry,
} from "@/features/budget/api"
import type {
  BudgetCategory,
  BudgetLedgerEntry,
  BudgetSetupState,
  BudgetSummary,
  BudgetTimelineItem,
  PlannedExpense,
} from "@/features/budget/types"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { ApiError, apiRequest } from "@/lib/api"
import { type Locale, isLocale, supportedLocales, translate } from "@/lib/i18n"
import {
  fallbackModules,
  budgetViewFromPath,
  budgetViews,
  moduleCatalog,
  moduleDescription,
  moduleHref,
  moduleKeyFromSection,
  moduleName,
  type AppModule,
} from "@/lib/modules"

type TokenPair = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
}

type CurrentUser = {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  status: "pending" | "active" | "blocked"
}

type UpdateCandidate = {
  version: string
  channel: "stable" | "unstable"
  name: string
  prerelease: boolean
  publishedAt: string
  htmlUrl: string
  releaseNotes: string
  manifestUrl?: string
}

type UpdateStatus = {
  state: "disabled" | "idle" | "running" | "succeeded" | "failed"
  version?: string
  channel?: string
  message?: string
}

type AuditEvent = {
  id: string
  occurredAt: string
  actorUserId?: string
  actorRole: string
  action: string
  module: string
  targetType: string
  targetId: string
  outcome: string
  ip: string
  userAgent: string
  errorCode: string
}

const TOKENS_STORAGE_KEY = "household.tokens"
const LOCALE_STORAGE_KEY = "household.locale"

const moduleIcons = {
  budget: IconWallet,
  shopping: IconShoppingCart,
  recipes: IconChefHat,
  meal_plan: IconClipboardList,
  calendar: IconCalendar,
  waste_schedule: IconRecycle,
} as const

export function AppShell({ children: _children }: { children: React.ReactNode }) {
  void _children

  const pathname = usePathname()
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") return "de"

    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(storedLocale) ? storedLocale : "de"
  })
  const [tokens, setTokens] = useState<TokenPair | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [modules, setModules] = useState<AppModule[]>(fallbackModules("de"))
  const [updateCandidates, setUpdateCandidates] = useState<{
    stable?: UpdateCandidate | null
    unstable?: UpdateCandidate | null
  } | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set(["budget"]))

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  )

  const activeModules = useMemo(
    () => modules.filter((module) => module.enabled && module.active),
    [modules],
  )
  const selectedSection = selectedSectionFromPath(pathname)
  const isHome = pathname === "/"
  const isAccount = selectedSection === "account"
  const isSettings = selectedSection === "settings"
  const selectedModuleKey =
    isHome || isAccount || isSettings
      ? undefined
      : moduleKeyFromSection(selectedSection) ?? activeModules[0]?.key
  const selectedModule = selectedModuleKey
    ? activeModules.find((module) => module.key === selectedModuleKey)
    : undefined
  const selectedTitle = isHome
    ? t("dashboard.title")
    : isAccount
      ? t("account.title")
      : isSettings
        ? t("settings.title")
        : selectedModule
          ? moduleName(selectedModule, locale)
          : t("app.name")

  const staticRoutes = useMemo(
    () => [
      ...Object.values(moduleCatalog).map((module) => module.route),
      "/account",
      "/settings",
    ],
    [],
  )

  const loadModules = useCallback(
    async (accessToken?: string) => {
      try {
        const data = await apiRequest<AppModule[]>("/modules", { accessToken })
        setModules(data)
        setError(null)
      } catch {
        setModules((current) => (current.length > 0 ? current : fallbackModules(locale)))
      }
    },
    [locale],
  )

  const hydrateSession = useCallback(
    async (nextTokens: TokenPair) => {
      try {
        const user = await apiRequest<CurrentUser>("/users/me", {
          accessToken: nextTokens.accessToken,
        })
        setCurrentUser(user)
        await loadModules(nextTokens.accessToken)
      } catch {
        window.localStorage.removeItem(TOKENS_STORAGE_KEY)
        setTokens(null)
        setCurrentUser(null)
      } finally {
        setLoading(false)
      }
    },
    [loadModules],
  )

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null)
      setMessage(null)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    void (async () => {
      const rawTokens = window.localStorage.getItem(TOKENS_STORAGE_KEY)
      if (!rawTokens) {
        setLoading(false)
        return
      }

      try {
        const parsedTokens = JSON.parse(rawTokens) as TokenPair
        setTokens(parsedTokens)
        await hydrateSession(parsedTokens)
      } catch {
        window.localStorage.removeItem(TOKENS_STORAGE_KEY)
        setLoading(false)
      }
    })()
  }, [hydrateSession])

  useEffect(() => {
    if (!currentUser) return

    staticRoutes.forEach((route) => {
      router.prefetch(route)
    })
  }, [currentUser, router, staticRoutes])

  const checkUpdates = useCallback(async () => {
    if (!tokens) return

    setError(null)
    setMessage(null)
    try {
      const candidates = await apiRequest<{
        stable?: UpdateCandidate | null
        unstable?: UpdateCandidate | null
      }>("/updates/candidates", { accessToken: tokens.accessToken })
      const status = await apiRequest<UpdateStatus>("/updates/status", {
        accessToken: tokens.accessToken,
      })
      setUpdateCandidates(candidates)
      setUpdateStatus(status)
      setMessage(t("updates.checked"))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }, [t, tokens])

  const loadAuditEvents = useCallback(async (showMessage = true) => {
    if (!tokens) return

    setError(null)
    try {
      const events = await apiRequest<AuditEvent[]>("/audit/events?limit=20", {
        accessToken: tokens.accessToken,
      })
      setAuditEvents(events)
      if (showMessage) {
        setMessage(t("audit.loaded"))
      }
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }, [t, tokens])

  useEffect(() => {
    if (!isSettings || currentUser?.role !== "admin" || !tokens) return

    const timer = window.setTimeout(() => {
      if (updateCandidates == null) {
        void checkUpdates()
      }
      if (auditEvents.length === 0) {
        void loadAuditEvents(false)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [auditEvents.length, checkUpdates, currentUser?.role, isSettings, loadAuditEvents, tokens, updateCandidates])

  async function login() {
    setError(null)
    setMessage(null)
    try {
      const nextTokens = await apiRequest<TokenPair>("/auth/authorize", {
        method: "POST",
        body: { username, password },
      })
      window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(nextTokens))
      setTokens(nextTokens)
      await hydrateSession(nextTokens)
      setPassword("")
      setMessage(t("auth.loggedIn"))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function register() {
    setError(null)
    setMessage(null)
    try {
      await apiRequest("/users", {
        method: "PUT",
        body: {
          name: registerName,
          email: registerEmail,
          password: registerPassword,
        },
      })
      setRegisterName("")
      setRegisterEmail("")
      setRegisterPassword("")
      setMessage(t("auth.registerDone"))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function changePassword() {
    if (!tokens) {
      setError(t("error.sessionMissing"))
      return
    }
    if (!currentPassword || !newPassword) {
      setError(t("error.passwordRequired"))
      return
    }

    setError(null)
    setMessage(null)
    try {
      await apiRequest("/users/me/password", {
        method: "PUT",
        accessToken: tokens.accessToken,
        body: { currentPassword, newPassword },
      })
      setCurrentPassword("")
      setNewPassword("")
      setMessage(t("account.passwordChanged"))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function logout() {
    if (tokens) {
      try {
        await apiRequest("/auth/logout", {
          method: "POST",
          accessToken: tokens.accessToken,
          body: { refreshToken: tokens.refreshToken },
        })
      } catch {
        // Client state is cleared even if logout request fails.
      }
    }

    window.localStorage.removeItem(TOKENS_STORAGE_KEY)
    setTokens(null)
    setCurrentUser(null)
    setMessage(null)
    setError(null)
    setUpdateCandidates(null)
    setUpdateStatus(null)
    setAuditEvents([])
    router.replace("/")
  }

  async function toggleModule(module: AppModule, active: boolean) {
    if (!tokens || currentUser?.role !== "admin") {
      setError(t("error.adminRequired"))
      return
    }

    const nextModules = modules.map((item) =>
      item.id === module.id ? { ...item, active } : item,
    )
    setModules(nextModules)
    setError(null)
    setMessage(null)

    try {
      await apiRequest("/modules/active", {
        method: "PATCH",
        accessToken: tokens.accessToken,
        body: {
          moduleIds: nextModules
            .filter((item) => item.enabled && item.active)
            .map((item) => item.id),
        },
      })
      setMessage(
        active
          ? t("services.activated", { name: moduleName(module, locale) })
          : t("services.deactivated", { name: moduleName(module, locale) }),
      )
    } catch (err) {
      setError(errorMessage(err, t))
      await loadModules(tokens.accessToken)
    }
  }

  async function startUpdate(candidate: UpdateCandidate) {
    if (!tokens) return

    setError(null)
    setMessage(null)
    try {
      const status = await apiRequest<UpdateStatus>("/updates/jobs", {
        method: "POST",
        accessToken: tokens.accessToken,
        body: { version: candidate.version, channel: candidate.channel },
      })
      setUpdateStatus(status)
      setMessage(t("updates.started", { version: candidate.version }))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("app.name")}</CardTitle>
            <CardDescription>{t("loading.session")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <LoginScreen
        title={t("app.name")}
        subtitle={t("app.localNetwork")}
        error={error}
        message={message}
        username={username}
        password={password}
        registerName={registerName}
        registerEmail={registerEmail}
        registerPassword={registerPassword}
        setUsername={setUsername}
        setPassword={setPassword}
        setRegisterName={setRegisterName}
        setRegisterEmail={setRegisterEmail}
        setRegisterPassword={setRegisterPassword}
        login={login}
        register={register}
        t={t}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-72 shrink-0 border-r bg-sidebar px-4 py-5 xl:flex xl:flex-col">
          <div className="mb-7 flex items-center gap-3 px-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <IconChartBar className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{t("app.name")}</h1>
              <p className="truncate text-xs text-muted-foreground">{t("app.localNetwork")}</p>
            </div>
          </div>

          <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto">
            <div className="space-y-1">
              <SidebarSectionLabel>{t("nav.main")}</SidebarSectionLabel>
              <SidebarLink href="/" active={isHome} icon={<IconChartBar className="size-4" />}>
                {t("dashboard.title")}
              </SidebarLink>
            </div>

            <div className="space-y-1">
              <SidebarSectionLabel>{t("nav.modules")}</SidebarSectionLabel>
              {activeModules.map((module) => {
                const isExpanded = expandedModules.has(module.key)

                return (
                  <SidebarModuleItem
                    key={module.id}
                    locale={locale}
                    module={module}
                    pathname={pathname}
                    expanded={isExpanded}
                    toggleExpanded={() =>
                      setExpandedModules((current) => {
                        const next = new Set(current)
                        if (next.has(module.key)) {
                          next.delete(module.key)
                        } else {
                          next.add(module.key)
                        }
                        return next
                      })
                    }
                    t={t}
                  />
                )
              })}
            </div>
          </nav>

          <div className="mt-6 border-t border-sidebar-border pt-4">
            <div className="mb-3 flex items-center gap-3 rounded-md px-2 py-2">
              <Avatar className="size-9">
                <AvatarFallback>{currentUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{currentUser.name}</p>
                <p className="truncate text-xs text-muted-foreground">{currentUser.role}</p>
              </div>
            </div>
            <div className="space-y-1">
              <SidebarLink href="/account" active={isAccount} icon={<IconUserCircle className="size-4" />}>
                {t("nav.account")}
              </SidebarLink>
              {currentUser.role === "admin" ? (
                <SidebarLink href="/settings" active={isSettings} icon={<IconSettings className="size-4" />}>
                  {t("nav.adminSettings")}
                </SidebarLink>
              ) : null}
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground transition hover:bg-accent"
              >
                <IconLogout className="size-4" />
                <span className="truncate">{t("nav.logout")}</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b px-5 py-4 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("app.subtitle")}</p>
                <h2 className="text-2xl font-semibold tracking-tight">{selectedTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <LanguageSwitcher locale={locale} setLocale={setLocale} t={t} />
                <ThemeSwitcher t={t} />
                <Avatar className="xl:hidden">
                  <AvatarFallback>{currentUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="hidden text-right sm:block xl:hidden">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.role}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={logout}
                  aria-label={t("nav.logout")}
                  className="xl:hidden"
                >
                  <IconLogout className="size-4" />
                </Button>
              </div>
            </div>
            <CompactNav
              locale={locale}
              pathname={pathname}
              activeModules={activeModules}
              isHome={isHome}
              isAccount={isAccount}
              isSettings={isSettings}
              isAdmin={currentUser.role === "admin"}
              t={t}
            />
          </header>

          <div className="flex-1 p-5 lg:p-8">
            <div className="space-y-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("error.title")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {message ? (
                <Alert>
                  <AlertTitle>{t("status.title")}</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}

              <div
                key={pathname}
                className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
              >
                {isHome ? (
                  <DashboardPage
                    accessToken={tokens?.accessToken}
                    modules={activeModules}
                    locale={locale}
                    t={t}
                  />
                ) : isAccount ? (
                  <AccountPanel
                    currentUser={currentUser}
                    currentPassword={currentPassword}
                    newPassword={newPassword}
                    setCurrentPassword={setCurrentPassword}
                    setNewPassword={setNewPassword}
                    changePassword={changePassword}
                    locale={locale}
                    setLocale={setLocale}
                    t={t}
                  />
                ) : isSettings ? (
                  <AdminSettingsPanel
                    currentUser={currentUser}
                    modules={modules}
                    locale={locale}
                    toggleModule={toggleModule}
                    updateCandidates={updateCandidates}
                    updateStatus={updateStatus}
                    checkUpdates={checkUpdates}
                    startUpdate={startUpdate}
                    auditEvents={auditEvents}
                    loadAuditEvents={loadAuditEvents}
                    t={t}
                  />
                ) : selectedModule ? (
                  <DashboardPanel
                    accessToken={tokens?.accessToken}
                    locale={locale}
                    pathname={pathname}
                    selectedModule={selectedModule}
                    t={t}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("dashboard.inactiveTitle")}</CardTitle>
                      <CardDescription>{t("dashboard.inactiveDescription")}</CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function LoginScreen(props: {
  title: string
  subtitle: string
  error: string | null
  message: string | null
  username: string
  password: string
  registerName: string
  registerEmail: string
  registerPassword: string
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  setRegisterName: (value: string) => void
  setRegisterEmail: (value: string) => void
  setRegisterPassword: (value: string) => void
  login: () => Promise<void>
  register: () => Promise<void>
  t: Translator
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <IconChartBar className="size-7" />
          </div>
          <p className="text-sm text-muted-foreground">{props.subtitle}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
        </div>
        {props.error ? (
          <Alert variant="destructive">
            <AlertTitle>{props.t("error.title")}</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        ) : null}
        {props.message ? (
          <Alert>
            <AlertTitle>{props.t("status.title")}</AlertTitle>
            <AlertDescription>{props.message}</AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{props.t("auth.title")}</CardTitle>
            <CardDescription>{props.t("auth.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{props.t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="register">{props.t("auth.registerTab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="pt-4">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void props.login()
                  }}
                >
                  <Field label={props.t("auth.username")}>
                    <Input value={props.username} onChange={(event) => props.setUsername(event.target.value)} />
                  </Field>
                  <Field label={props.t("auth.password")}>
                    <Input
                      type="password"
                      value={props.password}
                      onChange={(event) => props.setPassword(event.target.value)}
                    />
                  </Field>
                  <Button className="w-full" type="submit">
                    <IconLogin2 className="size-4" />
                    {props.t("auth.login")}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register" className="pt-4">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void props.register()
                  }}
                >
                  <Field label={props.t("auth.name")}>
                    <Input
                      value={props.registerName}
                      onChange={(event) => props.setRegisterName(event.target.value)}
                    />
                  </Field>
                  <Field label={props.t("auth.email")}>
                    <Input
                      value={props.registerEmail}
                      onChange={(event) => props.setRegisterEmail(event.target.value)}
                    />
                  </Field>
                  <Field label={props.t("auth.password")}>
                    <Input
                      type="password"
                      value={props.registerPassword}
                      onChange={(event) => props.setRegisterPassword(event.target.value)}
                    />
                  </Field>
                  <Button className="w-full" variant="secondary" type="submit">
                    <IconUserCheck className="size-4" />
                    {props.t("auth.register")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function AccountPanel(props: {
  currentUser: CurrentUser
  currentPassword: string
  newPassword: string
  setCurrentPassword: (value: string) => void
  setNewPassword: (value: string) => void
  changePassword: () => Promise<void>
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("account.title")} description={props.t("account.description")}>
      <SettingsSection title={props.t("account.profileTitle")} description={props.t("account.profileDescription")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField label={props.t("auth.name")} value={props.currentUser.name} />
          <SettingsField label={props.t("auth.email")} value={props.currentUser.email} />
          <SettingsField label={props.t("account.role")} value={props.currentUser.role} />
          <SettingsField label={props.t("account.status")} value={props.currentUser.status} />
        </div>
      </SettingsSection>

      <SettingsSection title={props.t("account.passwordTitle")} description={props.t("account.passwordDescription")}>
        <div className="rounded-md border bg-card p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={props.t("account.currentPassword")}>
              <Input
                type="password"
                value={props.currentPassword}
                onChange={(event) => props.setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label={props.t("account.newPassword")}>
              <Input
                type="password"
                value={props.newPassword}
                onChange={(event) => props.setNewPassword(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={props.changePassword}>{props.t("account.changePassword")}</Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={props.t("account.preferencesTitle")} description={props.t("account.preferencesDescription")}>
        <SettingsRow title={props.t("nav.language")} description={supportedLocales.join(" / ")}>
          <LanguageSwitcher locale={props.locale} setLocale={props.setLocale} t={props.t} />
        </SettingsRow>
        <SettingsRow
          title={props.t("nav.theme")}
          description={`${props.t("theme.light")} / ${props.t("theme.dark")} / ${props.t("theme.system")}`}
        >
          <ThemeSwitcher t={props.t} />
        </SettingsRow>
      </SettingsSection>
    </SettingsSurface>
  )
}

function AdminSettingsPanel(props: {
  currentUser: CurrentUser
  modules: AppModule[]
  locale: Locale
  toggleModule: (module: AppModule, active: boolean) => Promise<void>
  updateCandidates: {
    stable?: UpdateCandidate | null
    unstable?: UpdateCandidate | null
  } | null
  updateStatus: UpdateStatus | null
  checkUpdates: () => Promise<void>
  startUpdate: (candidate: UpdateCandidate) => Promise<void>
  auditEvents: AuditEvent[]
  loadAuditEvents: (showMessage?: boolean) => Promise<void>
  t: Translator
}) {
  if (props.currentUser.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{props.t("settings.forbiddenTitle")}</CardTitle>
          <CardDescription>{props.t("settings.forbiddenDescription")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const updateEntries = [
    ["stable", props.updateCandidates?.stable] as const,
    ["unstable", props.updateCandidates?.unstable] as const,
  ]

  return (
    <SettingsSurface title={props.t("settings.title")} description={props.t("settings.description")}>
      <SettingsSection title={props.t("services.title")} description={props.t("services.description")}>
        <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          {props.t("services.catalogHint")}
        </div>
        <div className="space-y-3">
          {props.modules.map((module) => {
            const Icon = moduleIcons[module.key as keyof typeof moduleIcons] ?? IconSettings
            return (
              <SettingsRow
                key={module.id}
                title={moduleName(module, props.locale)}
                description={`${moduleDescription(module, props.locale)} - ${
                  module.enabled ? props.t("services.available") : props.t("services.unavailable")
                }`}
              >
                <Icon className="size-4 text-muted-foreground" />
                <Switch
                  checked={module.enabled && module.active}
                  disabled={!module.enabled}
                  onCheckedChange={(checked) => props.toggleModule(module, checked)}
                  aria-label={props.t("services.switchLabel", {
                    name: moduleName(module, props.locale),
                  })}
                />
              </SettingsRow>
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={props.t("updates.title")} description={props.t("updates.description")}>
        <SettingsRow
          title={props.t("updates.status")}
          description={`${props.updateStatus?.state ?? props.t("updates.unknown")}${
            props.updateStatus?.message ? ` (${props.updateStatus.message})` : ""
          }`}
        >
          <Button variant="outline" onClick={props.checkUpdates}>
            <IconRefresh className="size-4" />
            {props.t("updates.check")}
          </Button>
        </SettingsRow>
        <div className="grid gap-3 md:grid-cols-2">
          {updateEntries.map(([channel, candidate]) => (
            <div key={channel} className="rounded-md border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium">
                  {channel === "stable" ? props.t("updates.stable") : props.t("updates.unstable")}
                </h3>
                <Badge variant={channel === "stable" ? "default" : "secondary"}>
                  {candidate?.version ?? props.t("updates.noRelease")}
                </Badge>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {candidate?.name || candidate?.releaseNotes || props.t("updates.notChecked")}
              </p>
              <Button
                className="w-full"
                disabled={!candidate || props.updateStatus?.state === "running"}
                onClick={() => candidate && props.startUpdate(candidate)}
              >
                <IconCloudDownload className="size-4" />
                {props.t("updates.install")}
              </Button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title={props.t("audit.title")}
        description={props.t("audit.description")}
        aside={
          <Button variant="outline" onClick={() => props.loadAuditEvents()}>
            <IconRefresh className="size-4" />
            {props.t("audit.load")}
          </Button>
        }
      >
        <div className="space-y-2">
          {props.auditEvents.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              {props.t("audit.empty")}
            </p>
          ) : (
            props.auditEvents.map((event) => (
              <div key={event.id} className="rounded-md border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{event.action}</span>
                  <Badge variant={event.outcome === "success" ? "default" : "destructive"}>
                    {event.outcome}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.module} -{" "}
                  {new Date(event.occurredAt).toLocaleString(props.locale === "de" ? "de-DE" : "en-US")} -{" "}
                  {event.actorRole || props.t("audit.systemActor")}
                </p>
                {event.errorCode ? (
                  <p className="mt-1 text-xs text-destructive">{event.errorCode}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SettingsSection>
    </SettingsSurface>
  )
}

function DashboardPanel(props: {
  accessToken?: string
  locale: Locale
  pathname: string
  selectedModule: AppModule
  t: Translator
}) {
  return (
    <div className="space-y-5">
      {props.selectedModule.key === "budget" ? (
        <BudgetPanel accessToken={props.accessToken} locale={props.locale} pathname={props.pathname} t={props.t} />
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

function BudgetPanel(props: {
  accessToken?: string
  locale: Locale
  pathname: string
  t: Translator
}) {
  const { accessToken, locale, pathname, t } = props
  const selectedBudgetView = budgetViewFromPath(pathname)
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [setup, setSetup] = useState<BudgetSetupState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [transactionKind, setTransactionKind] = useState<"income" | "expense">("expense")
  const [merchant, setMerchant] = useState("")
  const [splitMode, setSplitMode] = useState(false)
  const [splitCategoryId, setSplitCategoryId] = useState("")
  const [splitAmount, setSplitAmount] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [accountId, setAccountId] = useState("")
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [limit, setLimit] = useState("")
  const [carryover, setCarryover] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [categoryColor, setCategoryColor] = useState("#64748b")
  const [categoryIcon, setCategoryIcon] = useState("tag")
  const [categoryBehavior, setCategoryBehavior] = useState<BudgetCategory["behavior"]>("include_in_limit")
  const [plannedName, setPlannedName] = useState("")
  const [plannedAmount, setPlannedAmount] = useState("")
  const [plannedKind, setPlannedKind] = useState<PlannedExpense["kind"]>("fixed_cost")
  const [plannedCadence, setPlannedCadence] = useState<PlannedExpense["cadence"]>("monthly")
  const [plannedDueDay, setPlannedDueDay] = useState("1")
  const [plannedDueMonth, setPlannedDueMonth] = useState(String(new Date().getMonth() + 1))
  const [baseCurrency, setBaseCurrency] = useState("EUR")
  const [periodStartDay, setPeriodStartDay] = useState("1")
  const [bufferRule, setBufferRule] = useState<BudgetSetupState["bufferRule"]>("fixed")
  const [bufferValue, setBufferValue] = useState("0")
  const [initialIncomeName, setInitialIncomeName] = useState("")
  const [initialIncomeAmount, setInitialIncomeAmount] = useState("")
  const [openingKind, setOpeningKind] = useState<"buffer" | "savings" | "investment">("buffer")
  const [openingName, setOpeningName] = useState("")
  const [openingAmount, setOpeningAmount] = useState("")
  const [timeline, setTimeline] = useState<BudgetTimelineItem[]>([])
  const [timelineQuery, setTimelineQuery] = useState("")
  const [timelineKind, setTimelineKind] = useState("all")
  const [timelineStatus, setTimelineStatus] = useState("all")
  const [selectedTimeline, setSelectedTimeline] = useState<BudgetTimelineItem | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<{ entry: BudgetLedgerEntry; auditHistory: unknown } | null>(null)
  const [timelineAction, setTimelineAction] = useState<"correction" | "void" | "refund" | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [actionDescription, setActionDescription] = useState("")
  const [actionAmount, setActionAmount] = useState("")

  const currency = useCallback(
    (cents: number) =>
      new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
        style: "currency",
        currency: setup?.baseCurrency ?? "EUR",
      }).format(cents / 100),
    [locale, setup?.baseCurrency],
  )

  const hydrateSetup = useCallback((data: BudgetSetupState) => {
    setSetup(data)
    setBaseCurrency(data.baseCurrency)
    setPeriodStartDay(String(data.preferredPeriodStartDay))
    setBufferRule(data.bufferRule)
    setBufferValue(
      data.bufferRule === "fixed"
        ? centsToInput(data.bufferAmountCents)
        : String(data.bufferPercentageBasisPoints / 100),
    )
  }, [])

  const chartData = useMemo(
    () =>
      (summary?.categories ?? [])
        .filter((category) => category.spentCents > 0)
        .map((category) => ({
          key: category.id,
          label: category.name,
          value: category.spentCents / 100,
          color: category.color,
        })),
    [summary],
  )

  const loadSummary = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await loadBudgetSummary(accessToken)
      setSummary(data)
      setCategoryId((current) => current || data.categories[0]?.id || "")
      setSplitCategoryId((current) => current || data.categories[1]?.id || data.categories[0]?.id || "")
      setAccountId((current) => current || data.accounts[0]?.id || "")
      setLimit(centsToInput(data.period.spendingLimitCents))
      setCarryover(centsToInput(data.period.overspendCarryoverCents))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setLoading(false)
    }
  }, [accessToken, t])

  const loadSetup = useCallback(async () => {
    if (!accessToken) return
    const data = await loadBudgetSetup(accessToken)
    hydrateSetup(data)
  }, [accessToken, hydrateSetup])

  const loadTimeline = useCallback(async () => {
    if (!accessToken) return
    const parameters = new URLSearchParams()
    if (timelineQuery.trim()) parameters.set("query", timelineQuery.trim())
    if (timelineKind !== "all") parameters.set("kind", timelineKind)
    if (timelineStatus !== "all") parameters.set("status", timelineStatus)
    setTimeline(await loadBudgetTimeline(accessToken, parameters.toString()))
  }, [accessToken, timelineKind, timelineQuery, timelineStatus])

  useEffect(() => {
    if (!accessToken) return

    let active = true
    void (async () => {
      try {
        const [data, setupData] = await Promise.all([
          loadBudgetSummary(accessToken),
          loadBudgetSetup(accessToken),
        ])
        if (!active) return
        setSummary(data)
        hydrateSetup(setupData)
        setCategoryId((current) => current || data.categories[0]?.id || "")
        setSplitCategoryId((current) => current || data.categories[1]?.id || data.categories[0]?.id || "")
        setAccountId((current) => current || data.accounts[0]?.id || "")
        setLimit(centsToInput(data.period.spendingLimitCents))
        setCarryover(centsToInput(data.period.overspendCarryoverCents))
        setError(null)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t("error.unexpected"))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [accessToken, hydrateSetup, t])

  useEffect(() => {
    const timer = window.setTimeout(() => setError(null), 0)

    return () => window.clearTimeout(timer)
  }, [selectedBudgetView])

  useEffect(() => {
    if (!accessToken || selectedBudgetView !== "transactions") return
    const timer = window.setTimeout(() => void loadTimeline(), 150)
    return () => window.clearTimeout(timer)
  }, [accessToken, loadTimeline, selectedBudgetView])

  const createTransaction = async () => {
    if (!accessToken) return
    const parsedAmount = Number(amount.replace(",", "."))
    const amountCents = Math.round(parsedAmount * 100)
    if (!description.trim() || !Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t("budget.validation"))
      return
    }
    setSaving(true)
    try {
      const category = summary?.categories.find((entry) => entry.id === categoryId)
      const secondCategory = summary?.categories.find((entry) => entry.id === splitCategoryId)
      const firstSplitCents = splitMode ? parseEuroCents(splitAmount) : null
      if (splitMode && (!firstSplitCents || firstSplitCents >= amountCents || !splitCategoryId || splitCategoryId === categoryId)) {
        setError(t("budget.splitValidation"))
        return
      }
      await createBudgetLedgerEntry(accessToken, {
        kind: transactionKind,
        categoryId: transactionKind === "expense" ? categoryId || undefined : undefined,
        occurredOn,
        description,
        amountCents,
        affectsOrdinary: transactionKind === "income" || category?.behavior !== "exclude_from_limit",
        merchant,
        splits:
          transactionKind === "expense" && splitMode && firstSplitCents
            ? [
                {
                  categoryId,
                  amountCents: firstSplitCents,
                  useRemaining: false,
                  affectsOrdinary: category?.behavior !== "exclude_from_limit",
                },
                {
                  categoryId: splitCategoryId,
                  useRemaining: true,
                  affectsOrdinary: secondCategory?.behavior !== "exclude_from_limit",
                },
              ]
            : undefined,
      })
      setDescription("")
      setAmount("")
      setMerchant("")
      setSplitAmount("")
      await Promise.all([loadSummary(), loadTimeline()])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const savePeriod = async () => {
    if (!accessToken) return
    const spendingLimitCents = parseEuroCents(limit)
    const overspendCarryoverCents = parseEuroCents(carryover)
    if (spendingLimitCents === null || overspendCarryoverCents === null) {
      setError(t("budget.validation"))
      return
    }
    setSaving(true)
    try {
      await updateCurrentBudgetPeriod(accessToken, { spendingLimitCents, overspendCarryoverCents })
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const createCategory = async () => {
    if (!accessToken) return
    if (!categoryName.trim()) {
      setError(t("budget.categoryValidation"))
      return
    }
    setSaving(true)
    try {
      await createBudgetCategory(accessToken, {
        name: categoryName,
        color: categoryColor,
        icon: categoryIcon,
        behavior: categoryBehavior,
      })
      setCategoryName("")
      setCategoryColor("#64748b")
      setCategoryIcon("tag")
      setCategoryBehavior("include_in_limit")
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const updateCategory = async (category: BudgetCategory, patch: Partial<BudgetCategory>) => {
    if (!accessToken) return
    const nextCategory = { ...category, ...patch }
    setSaving(true)
    try {
      await updateBudgetCategory(accessToken, category.id, {
        name: nextCategory.name,
        color: nextCategory.color,
        icon: nextCategory.icon,
        behavior: nextCategory.behavior,
        archived: nextCategory.archived,
      })
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const createPlannedExpense = async () => {
    if (!accessToken) return
    const amountCents = parseEuroCents(plannedAmount)
    const dueDay = Number(plannedDueDay)
    const dueMonth = Number(plannedDueMonth)
    if (!plannedName.trim() || amountCents === null || !accountId || !Number.isInteger(dueDay)) {
      setError(t("budget.plannedValidation"))
      return
    }
    setSaving(true)
    try {
      const category = summary?.categories.find((entry) => entry.id === categoryId)
      await createPlannedExpenseRequest(accessToken, {
        accountId,
        categoryId,
        name: plannedName,
        kind: plannedKind,
        cadence: plannedCadence,
        amountCents,
        dueDay,
        dueMonth: plannedCadence === "yearly" ? dueMonth : undefined,
        includeInLimit: category?.behavior !== "exclude_from_limit",
        active: true,
      })
      setPlannedName("")
      setPlannedAmount("")
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const updatePlannedExpense = async (planned: PlannedExpense, patch: Partial<PlannedExpense>) => {
    if (!accessToken) return
    const nextPlanned = { ...planned, ...patch }
    setSaving(true)
    try {
      await updatePlannedExpenseRequest(accessToken, planned.id, {
        accountId: nextPlanned.accountId,
        categoryId: nextPlanned.categoryId,
        name: nextPlanned.name,
        kind: nextPlanned.kind,
        cadence: nextPlanned.cadence,
        amountCents: nextPlanned.amountCents,
        dueDay: nextPlanned.dueDay,
        dueMonth: nextPlanned.cadence === "yearly" ? nextPlanned.dueMonth : undefined,
        includeInLimit: nextPlanned.includeInLimit,
        active: nextPlanned.active,
      })
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const applyPlannedExpenses = async () => {
    if (!accessToken) return
    setSaving(true)
    try {
      await applyCurrentPlannedExpenses(accessToken)
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const saveSetup = async (settingsOnly: boolean) => {
    if (!accessToken) return
    const preferredPeriodStartDay = Number(periodStartDay)
    const parsedBuffer = Number(bufferValue.replace(",", "."))
    const incomeAmountCents = initialIncomeAmount ? parseEuroCents(initialIncomeAmount) : 0
    const openingAmountCents = openingAmount ? parseEuroCents(openingAmount) : 0
    if (
      !/^[A-Za-z]{3}$/.test(baseCurrency) ||
      !Number.isInteger(preferredPeriodStartDay) ||
      preferredPeriodStartDay < 1 ||
      preferredPeriodStartDay > 31 ||
      !Number.isFinite(parsedBuffer) ||
      parsedBuffer < 0 ||
      incomeAmountCents === null ||
      openingAmountCents === null
    ) {
      setError(t("budget.setupValidation"))
      return
    }
    setSaving(true)
    try {
      const body = {
        baseCurrency: baseCurrency.toUpperCase(),
        preferredPeriodStartDay,
        bufferRule,
        bufferAmountCents: bufferRule === "fixed" ? Math.round(parsedBuffer * 100) : 0,
        bufferPercentageBasisPoints: bufferRule === "percentage" ? Math.round(parsedBuffer * 100) : 0,
        incomePlans:
          !settingsOnly && initialIncomeName.trim() && incomeAmountCents > 0
            ? [{ name: initialIncomeName.trim(), amountCents: incomeAmountCents }]
            : [],
        openingAllocations:
          !settingsOnly && openingAmountCents > 0
            ? [{ kind: openingKind, name: openingName.trim(), amountCents: openingAmountCents }]
            : [],
      }
      const data = settingsOnly
        ? await updateBudgetSettings(accessToken, body)
        : await saveBudgetSetup(accessToken, body)
      hydrateSetup(data)
      await Promise.all([loadSummary(), loadSetup()])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const selectTimelineItem = async (item: BudgetTimelineItem) => {
    setSelectedTimeline(item)
    setTimelineAction(null)
    setActionReason("")
    setActionDescription(item.description)
    setActionAmount(centsToInput(item.amountCents))
    if (!accessToken || item.entryType !== "actual") {
      setSelectedDetails(null)
      return
    }
    try {
      setSelectedDetails(await loadBudgetLedgerDetails(accessToken, item.id))
    } catch {
      setSelectedDetails(null)
    }
  }

  const submitTimelineAction = async () => {
    if (!accessToken || !selectedTimeline || !timelineAction) return
    const amountCents = parseEuroCents(actionAmount)
    if (!actionReason.trim() || (timelineAction !== "void" && (amountCents === null || amountCents <= 0))) {
      setError(t("budget.timelineActionValidation"))
      return
    }
    setSaving(true)
    try {
      if (timelineAction === "void") {
        await voidBudgetLedgerEntry(accessToken, selectedTimeline.id, actionReason)
      } else if (timelineAction === "refund") {
        await refundBudgetLedgerEntry(accessToken, selectedTimeline.id, {
          occurredOn,
          amountCents,
          description: actionReason,
        })
      } else {
        await correctBudgetLedgerEntry(accessToken, selectedTimeline.id, {
          reason: actionReason,
          description: actionDescription.trim(),
          occurredOn: selectedTimeline.occurredOn,
          amountCents,
          categoryId: selectedTimeline.splits.length === 1 ? selectedTimeline.splits[0].categoryId : selectedTimeline.categoryId,
          affectsOrdinary: selectedTimeline.ordinaryImpactCents !== 0,
          merchant: selectedTimeline.merchant,
        })
      }
      setTimelineAction(null)
      setSelectedTimeline(null)
      setSelectedDetails(null)
      setActionReason("")
      await Promise.all([loadSummary(), loadTimeline()])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unexpected"))
    } finally {
      setSaving(false)
    }
  }

  const showOverview = selectedBudgetView === "overview"
  const showTransactions = selectedBudgetView === "transactions"
  const showPlanning = selectedBudgetView === "planning"
  const showSaving = selectedBudgetView === "saving"
  const showWishlist = selectedBudgetView === "wishlist"
  const showCategories = selectedBudgetView === "categories"
  const showReports = selectedBudgetView === "reports"
  const showSettings = selectedBudgetView === "settings"

  const setupFields = (onboarding: boolean) => (
    <div className="rounded-lg border bg-muted/10 p-4 sm:p-6">
      <div className="max-w-2xl">
        <h3 className="text-lg font-semibold">
          {t(onboarding ? "budget.setupTitle" : "budget.configurationTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(onboarding ? "budget.setupDescription" : "budget.configurationDescription")}
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={onboarding ? "setup-currency" : "settings-currency"}>
            {t("budget.baseCurrency")}
          </Label>
          <Input
            id={onboarding ? "setup-currency" : "settings-currency"}
            value={baseCurrency}
            maxLength={3}
            disabled={setup?.baseCurrencyLocked}
            onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
          />
          {setup?.baseCurrencyLocked ? (
            <p className="text-xs text-muted-foreground">{t("budget.currencyLocked")}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={onboarding ? "setup-start-day" : "settings-start-day"}>
            {t("budget.periodStartDay")}
          </Label>
          <Input
            id={onboarding ? "setup-start-day" : "settings-start-day"}
            type="number"
            min={1}
            max={31}
            value={periodStartDay}
            onChange={(event) => setPeriodStartDay(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("budget.periodStartHint")}</p>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("budget.bufferRule")}</Label>
          <FormSelect
            value={bufferRule}
            onValueChange={(value) => setBufferRule(value as BudgetSetupState["bufferRule"])}
            options={[
              { value: "fixed", label: t("budget.bufferFixed") },
              { value: "percentage", label: t("budget.bufferPercentage") },
            ]}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={onboarding ? "setup-buffer" : "settings-buffer"}>
            {bufferRule === "fixed" ? t("budget.bufferAmount") : t("budget.bufferPercent")}
          </Label>
          <Input
            id={onboarding ? "setup-buffer" : "settings-buffer"}
            inputMode="decimal"
            value={bufferValue}
            onChange={(event) => setBufferValue(event.target.value)}
          />
        </div>
      </div>
      {onboarding ? (
        <div className="mt-6 grid gap-5 border-t pt-5 lg:grid-cols-2">
          <div>
            <h4 className="font-medium">{t("budget.initialIncome")}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{t("budget.initialIncomeHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={initialIncomeName}
                onChange={(event) => setInitialIncomeName(event.target.value)}
                placeholder={t("budget.incomeName")}
              />
              <Input
                inputMode="decimal"
                value={initialIncomeAmount}
                onChange={(event) => setInitialIncomeAmount(event.target.value)}
                placeholder={t("budget.amount")}
              />
            </div>
          </div>
          <div>
            <h4 className="font-medium">{t("budget.openingAllocation")}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{t("budget.openingAllocationHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <FormSelect
                value={openingKind}
                onValueChange={(value) => setOpeningKind(value as typeof openingKind)}
                options={[
                  { value: "buffer", label: t("budget.buffer") },
                  { value: "savings", label: t("budget.savings") },
                  { value: "investment", label: t("budget.investment") },
                ]}
              />
              <Input
                value={openingName}
                onChange={(event) => setOpeningName(event.target.value)}
                placeholder={t("budget.allocationName")}
              />
              <Input
                inputMode="decimal"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder={t("budget.amount")}
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-6 flex justify-end">
        <Button onClick={() => saveSetup(!onboarding)} disabled={saving}>
          {saving ? t("budget.saving") : t(onboarding ? "budget.completeSetup" : "budget.saveConfiguration")}
        </Button>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t("budget.previewTitle")}</CardTitle>
          <CardDescription>{t("budget.previewDescription")}</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={loadSummary} disabled={loading} aria-label={t("budget.reload")}>
          <IconRefresh className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("error.title")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading && (!summary || !setup) ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : setup && !setup.completed ? (
          setupFields(true)
        ) : summary ? (
          <>
            {showOverview ? (
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label={t("budget.actualIncome")} value={currency(summary.actualIncomeCents)} />
              <Metric label={t("budget.fundedBuffer")} value={currency(summary.fundedBufferCents)} />
              <Metric label={t("budget.maximumOrdinary")} value={currency(summary.maximumOrdinaryCents)} />
              <Metric label={t("budget.remaining")} value={currency(summary.ordinaryAvailableCents)} />
            </div>
            ) : null}
            {showOverview || showTransactions ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              {showOverview ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-4">
                  <h3 className="font-medium">{t("chart.title")}</h3>
                  <p className="text-sm text-muted-foreground">{summary.period.name}</p>
                </div>
                {chartData.length > 0 ? (
                  <ChartContainer config={{ value: { label: t("chart.amount") } }}>
                    <BarChart data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent valueFormatter={(value) => currency(Math.round(Number(value) * 100))} />}
                      />
                      <Bar dataKey="value" radius={8}>
                        {chartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    {t("budget.noTransactions")}
                  </div>
                )}
              </div>
              ) : null}
              {showTransactions ? (
              <div className="rounded-lg border bg-muted/10 p-4">
                <div className="mb-4">
                  <h3 className="font-medium">{t("budget.ledgerTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("budget.ledgerDescription")}</p>
                </div>
                <div className="mb-4 grid gap-2 md:grid-cols-[minmax(10rem,1fr)_9rem_9rem_auto]">
                  <Input
                    value={timelineQuery}
                    onChange={(event) => setTimelineQuery(event.target.value)}
                    placeholder={t("budget.searchTimeline")}
                  />
                  <FormSelect
                    value={timelineKind}
                    onValueChange={setTimelineKind}
                    options={[
                      { value: "all", label: t("budget.filterAllKinds") },
                      { value: "income", label: t("budget.income") },
                      { value: "expense", label: t("budget.expense") },
                      { value: "refund", label: t("budget.refund") },
                    ]}
                  />
                  <FormSelect
                    value={timelineStatus}
                    onValueChange={setTimelineStatus}
                    options={[
                      { value: "all", label: t("budget.filterAllStatuses") },
                      { value: "expected", label: t("budget.statusExpected") },
                      { value: "actual", label: t("budget.statusActual") },
                      { value: "corrected", label: t("budget.statusCorrected") },
                      { value: "voided", label: t("budget.statusVoided") },
                    ]}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTimelineQuery("")
                      setTimelineKind("all")
                      setTimelineStatus("all")
                    }}
                  >
                    {t("budget.resetFilters")}
                  </Button>
                </div>
                <div className="grid gap-2">
                  {timeline.length === 0 ? (
                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                      {t("budget.noTransactions")}
                    </div>
                  ) : timeline.map((entry) => (
                    <Button
                      variant="ghost"
                      key={entry.id}
                      onClick={() => selectTimelineItem(entry)}
                      className="h-auto w-full items-center justify-between gap-4 rounded-md border bg-background p-3 text-left hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {[entry.occurredOn, entry.merchant, entry.status].filter(Boolean).join(" · ")}
                        </p>
                        {entry.splits.length > 0 ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {entry.splits.map((split) => `${split.categoryNameSnapshot} ${currency(split.amountCents)}`).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <span className={entry.kind === "income" || entry.kind === "refund" ? "font-medium text-emerald-600" : "font-medium"}>
                        {entry.kind === "income" || entry.kind === "refund" ? "+" : "−"}{currency(entry.amountCents)}
                      </span>
                    </Button>
                  ))}
                </div>
                {selectedTimeline ? (
                  <div className="mt-4 rounded-md border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-medium">{selectedTimeline.description}</h4>
                        <p className="text-xs text-muted-foreground">
                          {selectedTimeline.origin} · {selectedTimeline.status} · {t("budget.ordinaryImpact")}: {currency(selectedTimeline.ordinaryImpactCents)}
                        </p>
                      </div>
                      {selectedTimeline.entryType === "actual" && selectedTimeline.status === "actual" && selectedTimeline.kind !== "refund" ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedTimeline.splits.length <= 1 ? (
                            <Button size="sm" variant="outline" onClick={() => setTimelineAction("correction")}>{t("budget.correct")}</Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => setTimelineAction("void")}>{t("budget.void")}</Button>
                          {selectedTimeline.kind === "expense" ? (
                            <Button size="sm" variant="outline" onClick={() => setTimelineAction("refund")}>{t("budget.refund")}</Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {selectedTimeline.splits.length > 0 ? (
                      <div className="mt-3 grid gap-1 text-sm">
                        {selectedTimeline.splits.map((split) => (
                          <div key={split.id} className="flex justify-between gap-3">
                            <span>{split.categoryNameSnapshot}</span>
                            <span>{currency(split.amountCents)} · {currency(split.ordinaryImpactCents)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {selectedDetails ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("budget.auditAvailable")}: {JSON.stringify(selectedDetails.auditHistory)}
                      </p>
                    ) : null}
                    {timelineAction ? (
                      <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                        {timelineAction === "correction" ? (
                          <Input value={actionDescription} onChange={(event) => setActionDescription(event.target.value)} placeholder={t("budget.description")} />
                        ) : null}
                        {timelineAction !== "void" ? (
                          <Input inputMode="decimal" value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} placeholder={t("budget.amount")} />
                        ) : null}
                        <Input value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder={t("budget.reason")} />
                        <Button onClick={submitTimelineAction} disabled={saving}>{t("budget.confirmAction")}</Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              ) : null}
              {showTransactions ? (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium">{t("budget.newTransaction")}</h3>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>{t("budget.transactionKind")}</Label>
                    <FormSelect
                      value={transactionKind}
                      onValueChange={(value) => setTransactionKind(value as typeof transactionKind)}
                      options={[
                        { value: "expense", label: t("budget.expense") },
                        { value: "income", label: t("budget.income") },
                      ]}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="budget-description">{t("budget.description")}</Label>
                    <Input id="budget-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="budget-merchant">{t("budget.merchant")}</Label>
                    <Input id="budget-merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} />
                    <p className="text-xs text-muted-foreground">{t("budget.merchantHint")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="budget-amount">{t("budget.amount")}</Label>
                      <Input id="budget-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="budget-date">{t("budget.date")}</Label>
                      <Input id="budget-date" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
                    </div>
                  </div>
                  {transactionKind === "expense" ? (
                  <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="budget-category">{t("budget.category")}</Label>
                    <FormSelect
                      id="budget-category"
                      value={categoryId}
                      onValueChange={setCategoryId}
                      options={summary.categories.filter((category) => !category.archived).map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div>
                      <Label htmlFor="budget-split-mode">{t("budget.splitTransaction")}</Label>
                      <p className="text-xs text-muted-foreground">{t("budget.splitHint")}</p>
                    </div>
                    <Switch id="budget-split-mode" checked={splitMode} onCheckedChange={setSplitMode} />
                  </div>
                  {splitMode ? (
                    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>{t("budget.firstSplitAmount")}</Label>
                        <Input inputMode="decimal" value={splitAmount} onChange={(event) => setSplitAmount(event.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>{t("budget.remainingCategory")}</Label>
                        <FormSelect
                          value={splitCategoryId}
                          onValueChange={setSplitCategoryId}
                          options={summary.categories.filter((category) => !category.archived).map((category) => ({
                            value: category.id,
                            label: category.name,
                          }))}
                        />
                      </div>
                    </div>
                  ) : null}
                  </>
                  ) : null}
                  <Button onClick={createTransaction} disabled={saving}>
                    {saving ? t("budget.saving") : t("budget.addTransaction")}
                  </Button>
                </div>
              </div>
              ) : null}
            </div>
            ) : null}
            {showSettings ? setupFields(false) : null}
            {showSettings || showCategories ? (
            <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
              {showSettings ? (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium">{t("budget.periodSettings")}</h3>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="budget-limit">{t("budget.monthlyLimit")}</Label>
                    <Input id="budget-limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="budget-carryover">{t("budget.carryover")}</Label>
                    <Input id="budget-carryover" inputMode="decimal" value={carryover} onChange={(event) => setCarryover(event.target.value)} />
                  </div>
                  <Button onClick={savePeriod} disabled={saving}>{t("budget.saveSettings")}</Button>
                </div>
              </div>
              ) : null}
              {showCategories ? (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium">{t("budget.categoriesTitle")}</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(8rem,1fr)_7rem_8rem_10rem_auto]">
                  <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder={t("budget.categoryName")} />
                  <Input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} aria-label={t("budget.categoryColor")} />
                  <Input value={categoryIcon} onChange={(event) => setCategoryIcon(event.target.value)} placeholder={t("budget.categoryIcon")} />
                  <FormSelect
                    value={categoryBehavior}
                    onValueChange={(value) => setCategoryBehavior(value as BudgetCategory["behavior"])}
                    options={[
                      { value: "include_in_limit", label: t("budget.includeInLimit") },
                      { value: "exclude_from_limit", label: t("budget.excludeFromLimit") },
                    ]}
                  />
                  <Button onClick={createCategory} disabled={saving}>{t("budget.addCategory")}</Button>
                </div>
                <div className="mt-4 grid gap-2">
                  {summary.categories.map((category) => (
                    <div key={category.id} className={`grid gap-2 rounded-md border p-3 lg:grid-cols-[minmax(8rem,1fr)_7rem_8rem_10rem_auto_auto] ${category.archived ? "opacity-60" : ""}`}>
                      <Input
                        value={category.name}
                        disabled={category.name === "Nicht speichern"}
                        onChange={(event) => updateCategory(category, { name: event.target.value })}
                        aria-label={t("budget.categoryName")}
                      />
                      <Input
                        type="color"
                        value={category.color}
                        onChange={(event) => updateCategory(category, { color: event.target.value })}
                        aria-label={t("budget.categoryColor")}
                      />
                      <Input
                        value={category.icon}
                        onChange={(event) => updateCategory(category, { icon: event.target.value })}
                        aria-label={t("budget.categoryIcon")}
                      />
                      <FormSelect
                        value={category.behavior}
                        onValueChange={(value) => updateCategory(category, { behavior: value as BudgetCategory["behavior"] })}
                        options={[
                          { value: "include_in_limit", label: t("budget.includeInLimit") },
                          { value: "exclude_from_limit", label: t("budget.excludeFromLimit") },
                        ]}
                      />
                      <div className="flex items-center justify-end text-sm text-muted-foreground">
                        {currency(category.spentCents)}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => updateCategory(category, { archived: !category.archived })}
                        disabled={saving || category.name === "Nicht speichern"}
                      >
                        {category.archived ? t("budget.restoreCategory") : t("budget.archiveCategory")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              ) : null}
            </div>
            ) : null}
            {showPlanning ? (
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{t("budget.plannedTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("budget.plannedDescription")}</p>
                </div>
                <Button onClick={applyPlannedExpenses} disabled={saving}>
                  {t("budget.applyPlanned")}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(8rem,1fr)_7rem_9rem_8rem_5rem_5rem_auto]">
                <Input value={plannedName} onChange={(event) => setPlannedName(event.target.value)} placeholder={t("budget.plannedName")} />
                <Input inputMode="decimal" value={plannedAmount} onChange={(event) => setPlannedAmount(event.target.value)} placeholder={t("budget.amount")} />
                <FormSelect
                  value={plannedKind}
                  onValueChange={(value) => setPlannedKind(value as PlannedExpense["kind"])}
                  options={[
                    { value: "fixed_cost", label: t("budget.fixedCost") },
                    { value: "subscription", label: t("budget.subscription") },
                  ]}
                />
                <FormSelect
                  value={plannedCadence}
                  onValueChange={(value) => setPlannedCadence(value as PlannedExpense["cadence"])}
                  options={[
                    { value: "monthly", label: t("budget.monthly") },
                    { value: "yearly", label: t("budget.yearly") },
                  ]}
                />
                <Input inputMode="numeric" value={plannedDueDay} onChange={(event) => setPlannedDueDay(event.target.value)} aria-label={t("budget.dueDay")} />
                <Input
                  inputMode="numeric"
                  value={plannedDueMonth}
                  onChange={(event) => setPlannedDueMonth(event.target.value)}
                  disabled={plannedCadence !== "yearly"}
                  aria-label={t("budget.dueMonth")}
                />
                <Button onClick={createPlannedExpense} disabled={saving}>{t("budget.addPlanned")}</Button>
              </div>
              <div className="mt-4 grid gap-2">
                {(summary.plannedExpenses ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t("budget.noPlanned")}
                  </div>
                ) : (
                  summary.plannedExpenses.map((planned) => (
                    <div key={planned.id} className="grid gap-2 rounded-md border p-3 lg:grid-cols-[minmax(8rem,1fr)_7rem_9rem_8rem_6rem_6rem_7rem]">
                      <Input
                        value={planned.name}
                        onChange={(event) => updatePlannedExpense(planned, { name: event.target.value })}
                        aria-label={t("budget.plannedName")}
                      />
                      <Input
                        inputMode="decimal"
                        value={centsToInput(planned.amountCents)}
                        onChange={(event) => {
                          const amountCents = parseEuroCents(event.target.value)
                          if (amountCents !== null) void updatePlannedExpense(planned, { amountCents })
                        }}
                        aria-label={t("budget.amount")}
                      />
                      <FormSelect
                        value={planned.kind}
                        onValueChange={(value) => updatePlannedExpense(planned, { kind: value as PlannedExpense["kind"] })}
                        options={[
                          { value: "fixed_cost", label: t("budget.fixedCost") },
                          { value: "subscription", label: t("budget.subscription") },
                        ]}
                      />
                      <FormSelect
                        value={planned.cadence}
                        onValueChange={(value) => updatePlannedExpense(planned, { cadence: value as PlannedExpense["cadence"] })}
                        options={[
                          { value: "monthly", label: t("budget.monthly") },
                          { value: "yearly", label: t("budget.yearly") },
                        ]}
                      />
                      <Input
                        inputMode="numeric"
                        value={String(planned.dueDay)}
                        onChange={(event) => updatePlannedExpense(planned, { dueDay: Number(event.target.value) })}
                        aria-label={t("budget.dueDay")}
                      />
                      <Input
                        inputMode="numeric"
                        value={String(planned.dueMonth ?? "")}
                        disabled={planned.cadence !== "yearly"}
                        onChange={(event) => updatePlannedExpense(planned, { dueMonth: Number(event.target.value) })}
                        aria-label={t("budget.dueMonth")}
                      />
                      <Button
                        variant={planned.active ? "outline" : "secondary"}
                        onClick={() => updatePlannedExpense(planned, { active: !planned.active })}
                        disabled={saving}
                      >
                        {planned.appliedInCurrentPeriod ? t("budget.applied") : planned.active ? t("budget.active") : t("budget.inactive")}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            ) : null}
            {showSaving || showWishlist || showReports ? (
              <div className="rounded-lg border border-dashed bg-muted/10 p-8 text-center sm:p-12">
                <h3 className="text-lg font-semibold">
                  {t(
                    showSaving
                      ? "budget.emptySavingTitle"
                      : showWishlist
                        ? "budget.emptyWishlistTitle"
                        : "budget.emptyReportsTitle",
                  )}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  {t(
                    showSaving
                      ? "budget.emptySavingDescription"
                      : showWishlist
                        ? "budget.emptyWishlistDescription"
                        : "budget.emptyReportsDescription",
                  )}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function parseEuroCents(value: string) {
  const parsed = Number(value.replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function centsToInput(cents: number) {
  return String((cents / 100).toFixed(2))
}

function SidebarSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

function SidebarModuleItem(props: {
  locale: Locale
  module: AppModule
  pathname: string
  expanded: boolean
  toggleExpanded: () => void
  t: Translator
}) {
  const Icon = moduleIcons[props.module.key as keyof typeof moduleIcons] ?? IconSettings
  const href = moduleHref(props.module)
  const isActive = props.pathname === href || props.pathname.startsWith(`${href}/`)
  const children =
    props.module.key === "budget"
      ? Object.entries(budgetViews).map(([key, view]) => ({
          key,
          href: view.route,
          label: props.t(view.labelKey),
          active: budgetViewFromPath(props.pathname) === key,
        }))
      : []

  if (children.length === 0) {
    return (
      <SidebarLink href={href} active={isActive} icon={<Icon className="size-4" />}>
        {moduleName(props.module, props.locale)}
      </SidebarLink>
    )
  }

  const Chevron = props.expanded ? IconChevronDown : IconChevronRight

  return (
    <div>
      <button
        type="button"
        onClick={props.toggleExpanded}
        aria-expanded={props.expanded}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
          isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-accent"
        }`}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{moduleName(props.module, props.locale)}</span>
        <Chevron className="size-4 shrink-0" />
      </button>
      {props.expanded ? (
        <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
          {children.map((child) => (
            <SidebarLink key={child.key} href={child.href} active={child.active} nested>
              {child.label}
            </SidebarLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SidebarLink({
  href,
  active,
  icon,
  nested,
  children,
}: {
  href: string
  active: boolean
  icon?: ReactNode
  nested?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${
        nested ? "text-xs" : "text-sm"
      } ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-accent"}`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  )
}

function CompactNav(props: {
  locale: Locale
  pathname: string
  activeModules: AppModule[]
  isHome: boolean
  isAccount: boolean
  isSettings: boolean
  isAdmin: boolean
  t: Translator
}) {
  return (
    <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
      <Button variant={props.isHome ? "default" : "outline"} size="sm" asChild>
        <Link href="/">{props.t("dashboard.title")}</Link>
      </Button>
      {props.activeModules.map((module) => (
        <div key={module.id} className="flex gap-2">
          <Button
            variant={
              props.pathname === moduleHref(module) || props.pathname.startsWith(`${moduleHref(module)}/`)
                ? "default"
                : "outline"
            }
            size="sm"
            asChild
          >
            <Link href={moduleHref(module)}>{moduleName(module, props.locale)}</Link>
          </Button>
          {module.key === "budget" && props.pathname.startsWith("/budget") ? (
            Object.entries(budgetViews).map(([key, view]) => (
              <Button
                key={key}
                variant={budgetViewFromPath(props.pathname) === key ? "secondary" : "outline"}
                size="sm"
                asChild
              >
                <Link href={view.route}>{props.t(view.labelKey)}</Link>
              </Button>
            ))
          ) : null}
        </div>
      ))}
      <Button variant={props.isAccount ? "default" : "outline"} size="sm" asChild>
        <Link href="/account">{props.t("nav.account")}</Link>
      </Button>
      {props.isAdmin ? (
        <Button variant={props.isSettings ? "default" : "outline"} size="sm" asChild>
          <Link href="/settings">{props.t("nav.adminSettings")}</Link>
        </Button>
      ) : null}
    </nav>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ThemeSwitcher({ t }: { t: Translator }) {
  const { setTheme, theme } = useTheme()
  const activeTheme = theme ?? "system"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconDeviceDesktop className="size-4" />
          {t("nav.theme")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("nav.theme")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={activeTheme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <IconSun className="size-4" />
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <IconMoon className="size-4" />
            {t("theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <IconDeviceDesktop className="size-4" />
            {t("theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageSwitcher({
  locale,
  setLocale,
  t,
}: {
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconLanguage className="size-4" />
          {t("nav.language")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("nav.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => isLocale(value) && setLocale(value)}>
          <DropdownMenuRadioItem value="de">{t("language.de")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">{t("language.en")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

type Translator = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => string

function errorMessage(err: unknown, t: Translator) {
  if (err instanceof ApiError) {
    return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return t("error.unexpected")
}

function selectedSectionFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? ""
}

"use client"

import { IconChevronRight, IconHome, IconLogout, IconPigMoney, IconSettings, IconUserCircle } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest } from "@/lib/api"
import {
  fallbackModules,
  budgetViewFromPath,
  budgetViews,
  moduleCatalog,
  moduleKeyFromSection,
  moduleName,
  type AppModule,
} from "@/lib/modules"
import { type Locale, isLocale, translate } from "@/lib/i18n"

import { BudgetSubnav, MobileTabBar, Sidebar, SidebarButton, SidebarLink, SidebarModuleItem, SidebarSectionLabel } from "@/components/app/sidebar"
import { AppearanceToggle } from "@/components/app/switchers"
import { AccountPanel } from "@/features/account/account-panel"
import { AdminSettingsPanel } from "@/features/admin/admin-settings-panel"
import type { AuditEvent, UpdateCandidate, UpdateStatus } from "@/features/admin/types"
import { LoginScreen } from "@/features/auth/login-screen"
import { DashboardPanel } from "@/features/dashboard/module-panel"
import { errorMessage } from "@/lib/error-message"
import { LOCALE_STORAGE_KEY, TOKENS_STORAGE_KEY } from "@/lib/session"
import { applyTheme, isThemeId, type ThemeId } from "@/lib/theme"
import type { CurrentUser, TokenPair } from "@/lib/session"

export function AppShell({ children: _children }: { children: React.ReactNode }) {
  void _children

  const pathname = usePathname()
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>("de")
  const [localeReady, setLocaleReady] = useState(false)
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
          ? selectedModule.key === "budget"
            ? t(budgetViews[budgetViewFromPath(pathname)].labelKey)
            : moduleName(selectedModule, locale)
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
        if (isThemeId(user.theme)) applyTheme(user.theme)
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
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    const timer = window.setTimeout(() => {
      if (isLocale(storedLocale)) setLocale(storedLocale)
      setLocaleReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (localeReady) window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale, localeReady])

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

  // The theme is applied instantly by the picker; the profile keeps it for other devices.
  async function saveTheme(theme: ThemeId) {
    if (!tokens) return
    try {
      const user = await apiRequest<CurrentUser>("/users/me", {
        method: "PATCH",
        accessToken: tokens.accessToken,
        body: { theme },
      })
      setCurrentUser(user)
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

  const isAdmin = currentUser.role === "admin"
  const inBudget = selectedModule?.key === "budget"
  const crumb = selectedModule ? moduleName(selectedModule, locale) : t("app.subtitle")
  const initials = currentUser.name.slice(0, 2).toUpperCase()
  // Settings pages and the monthly budget render their own large title.
  const showTitle = isHome || (Boolean(selectedModule) && !pathname.startsWith("/budget/preview"))

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            <span className="icon-tile bg-primary text-primary-foreground">
              <IconPigMoney className="size-4" strokeWidth={2} />
            </span>
            <span className="font-semibold">{t("app.name")}</span>
          </div>
        }
        footer={
          <>
            <SidebarLink href="/account" active={isAccount} icon={<IconUserCircle className="size-4" strokeWidth={1.8} />}>
              {t("nav.account")}
            </SidebarLink>
            {isAdmin ? (
              <SidebarLink href="/settings" active={isSettings} icon={<IconSettings className="size-4" strokeWidth={1.8} />}>
                {t("nav.adminSettings")}
              </SidebarLink>
            ) : null}
            <SidebarButton icon={<IconLogout className="size-4" strokeWidth={1.8} />} onClick={logout}>
              {t("nav.logout")}
            </SidebarButton>
            <div className="mt-1 flex items-center gap-2 px-2.5 py-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-fill text-[9px] font-semibold">{initials}</span>
              <span className="min-w-0 flex-1 truncate">{currentUser.name}</span>
              <span className="text-[11px] text-muted-foreground">{currentUser.role}</span>
            </div>
          </>
        }
      >
        <div>
          <SidebarLink href="/" active={isHome} icon={<IconHome className="size-4" strokeWidth={1.8} />}>
            {t("dashboard.title")}
          </SidebarLink>
        </div>
        <div>
          <SidebarSectionLabel>{t("nav.modules")}</SidebarSectionLabel>
          <div className="space-y-px">
            {activeModules.map((module) => (
              <SidebarModuleItem key={module.id} locale={locale} module={module} pathname={pathname} t={t} />
            ))}
          </div>
        </div>
      </Sidebar>

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-10 flex h-[52px] items-center justify-between gap-3 px-4 shadow-[inset_0_-0.5px_0_var(--hairline)] lg:px-8">
          <div className="flex min-w-0 items-center gap-1">
            <span className="hidden truncate text-muted-foreground sm:inline">{crumb}</span>
            <IconChevronRight className="hidden size-3 shrink-0 text-muted-foreground/60 sm:inline" />
            <span className="truncate font-semibold">{selectedTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <AppearanceToggle t={t} />
            <button
              type="button"
              onClick={logout}
              aria-label={t("nav.logout")}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-3 hover:text-foreground lg:hidden"
            >
              <IconLogout className="size-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 lg:px-8 lg:pb-12">
          <div className="space-y-5">
            {inBudget ? <BudgetSubnav pathname={pathname} t={t} /> : null}
            {showTitle ? (
              <div>
                <h1 className="text-[28px] font-bold tracking-[-0.02em] lg:text-[34px]">{selectedTitle}</h1>
                <p className="mt-0.5 text-muted-foreground">{crumb}</p>
              </div>
            ) : null}
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

            <div key={pathname} className="rise">
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
                  saveTheme={saveTheme}
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
        </main>
      </div>

      <MobileTabBar
        locale={locale}
        pathname={pathname}
        activeModules={activeModules}
        isHome={isHome}
        isAccount={isAccount}
        isSettings={isSettings}
        isAdmin={isAdmin}
        t={t}
      />
    </div>
  )
}

function selectedSectionFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? ""
}

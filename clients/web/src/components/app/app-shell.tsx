"use client"

import { IconHome, IconSettings, IconShield, IconUserCircle } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, apiRequest } from "@/lib/api"
import {
  fallbackModules,
  budgetViewEntries,
  budgetViews,
  moduleCatalog,
  moduleHref,
  moduleKeyFromSection,
  moduleName,
  type AppModule,
} from "@/lib/modules"
import { type Locale, isLocale, translate } from "@/lib/i18n"

import {
  BudgetSubnav,
  MobileTabBar,
  Sidebar,
  SidebarGroupLabel,
  SidebarLink,
  SidebarModuleNav,
  moduleIcons,
  useSidebarCollapsed,
} from "@/components/app/sidebar"
import { GlobalSearch, type SearchDestination } from "@/components/app/global-search"
import { ProfileMenu } from "@/components/app/profile-menu"
import { AppearanceToggle } from "@/components/app/switchers"
import { Topbar } from "@/components/app/topbar"
import { AccountPanel } from "@/features/account/account-panel"
import { AdminSettingsPanel } from "@/features/admin/admin-settings-panel"
import { SettingsPanel } from "@/features/settings/settings-panel"
import type { AuditEvent, UpdateCandidate, UpdateStatus } from "@/features/admin/types"
import { LoginScreen } from "@/features/auth/login-screen"
import { DashboardPanel } from "@/features/dashboard/module-panel"
import { errorMessage } from "@/lib/error-message"
import { LOCALE_STORAGE_KEY, TOKENS_STORAGE_KEY, registerSession } from "@/lib/session"
import { applyTheme, isThemeId, type ThemeId } from "@/lib/theme"
import type { CurrentUser, TokenPair } from "@/lib/session"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed()
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
  const isAdminSettings = selectedSection === "admin"
  const selectedModuleKey =
    isHome || isAccount || isSettings || isAdminSettings
      ? undefined
      : moduleKeyFromSection(selectedSection) ?? activeModules[0]?.key
  const selectedModule = selectedModuleKey
    ? activeModules.find((module) => module.key === selectedModuleKey)
    : undefined

  const staticRoutes = useMemo(
    () => [
      ...Object.values(moduleCatalog).map((module) => module.route),
      "/account",
      "/settings",
      "/admin/settings",
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
      } catch (err) {
        // Only an actual rejection ends the session. A restarting API or a
        // dropped network must not log the user out; api.ts has already tried
        // to refresh by the time a 401 reaches here.
        if (err instanceof ApiError && err.status === 401) {
          window.localStorage.removeItem(TOKENS_STORAGE_KEY)
          setTokens(null)
          setCurrentUser(null)
        } else {
          setError(errorMessage(err, t))
        }
      } finally {
        setLoading(false)
      }
    },
    [loadModules, t],
  )

  // api.ts refreshes expired access tokens through this and, when the refresh
  // token is spent too, ends the session here instead of letting the user keep
  // clicking into 401s.
  const tokensRef = useRef<TokenPair | null>(null)
  useEffect(() => {
    tokensRef.current = tokens
  }, [tokens])

  useEffect(() => {
    registerSession({
      tokens: () => tokensRef.current,
      adopt: (next) => {
        window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(next))
        setTokens(next)
      },
      expire: () => {
        window.localStorage.removeItem(TOKENS_STORAGE_KEY)
        setTokens(null)
        setCurrentUser(null)
        setMessage(null)
        setError(t("auth.sessionExpired"))
      },
    })
    return () => registerSession(null)
  }, [t])

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

  // The admin page loads candidates on its own; only a click on "check" earns a banner.
  const checkUpdates = useCallback(async (showMessage = true) => {
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
      if (showMessage) setMessage(t("updates.checked"))
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
    if (!isAdminSettings || currentUser?.role !== "admin" || !tokens) return

    const timer = window.setTimeout(() => {
      if (updateCandidates == null) {
        void checkUpdates(false)
      }
      if (auditEvents.length === 0) {
        void loadAuditEvents(false)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [auditEvents.length, checkUpdates, currentUser?.role, isAdminSettings, loadAuditEvents, tokens, updateCandidates])

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
      // No success banner: landing on the dashboard already says the login worked.
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

  // Throwaway prototype routes render on their own, without session or chrome.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/prototype")) return children

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
  const budgetActive = activeModules.some((module) => module.key === "budget")
  const searchDestinations = destinationsFor({ activeModules, isAdmin, locale, t })

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar
        appName={t("app.name")}
        collapsed={collapsed}
        toggleSidebar={toggleSidebar}
        collapseLabel={t("nav.collapseSidebar")}
        expandLabel={t("nav.expandSidebar")}
        search={
          <GlobalSearch
            destinations={searchDestinations}
            expensesHref={budgetActive ? budgetViews.expenses.route : undefined}
            t={t}
          />
        }
        actions={
          <>
            <AppearanceToggle t={t} />
            <ProfileMenu name={currentUser.name} logout={logout} t={t} />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed}>
          <SidebarGroupLabel collapsed={collapsed}>{t("nav.main")}</SidebarGroupLabel>
          <SidebarLink collapsed={collapsed} href="/" active={isHome} icon={<IconHome />}>
            {t("dashboard.title")}
          </SidebarLink>
          {activeModules.map((module) => (
            <SidebarModuleNav
              key={module.id}
              collapsed={collapsed}
              locale={locale}
              module={module}
              pathname={pathname}
              t={t}
            />
          ))}
          {isAdmin ? (
            <>
              <SidebarGroupLabel collapsed={collapsed}>{t("nav.admin")}</SidebarGroupLabel>
              <SidebarLink
                collapsed={collapsed}
                href="/admin/settings"
                level={1}
                active={isAdminSettings}
                icon={<IconShield />}
              >
                {t("nav.adminSettings")}
              </SidebarLink>
            </>
          ) : null}
        </Sidebar>

        <main className="min-w-0 flex-1 overflow-y-auto bg-canvas px-4 pt-5 pb-32 shadow-[inset_5px_5px_10px_rgb(0_0_0/0.02)] lg:rounded-tl-3xl lg:p-6">
          <div className="space-y-5">
            {inBudget ? <BudgetSubnav pathname={pathname} t={t} /> : null}
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
                  t={t}
                />
              ) : isSettings ? (
                <SettingsPanel saveTheme={saveTheme} locale={locale} setLocale={setLocale} t={t} />
              ) : isAdminSettings ? (
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
                  isAdmin={currentUser?.role === "admin"}
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
        isAdminSettings={isAdminSettings}
        isAdmin={isAdmin}
        t={t}
      />
    </div>
  )
}

function selectedSectionFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? ""
}

/**
 * Everything the topbar search can jump to, in sidebar order: the dashboard,
 * each active module and its pages, then the personal and admin places.
 */
function destinationsFor(input: {
  activeModules: AppModule[]
  isAdmin: boolean
  locale: Locale
  t: (key: Parameters<typeof translate>[1]) => string
}): SearchDestination[] {
  const { t } = input
  const modules = input.activeModules.flatMap((module): SearchDestination[] => {
    const name = moduleName(module, input.locale)
    const icon = moduleIcons[module.key as keyof typeof moduleIcons] ?? IconHome
    if (module.key !== "budget") return [{ key: module.key, label: name, href: moduleHref(module), icon }]
    return budgetViewEntries.map(([key, view]) => ({ key: `budget.${key}`, label: t(view.labelKey), group: name, href: view.route, icon }))
  })
  return [
    { key: "home", label: t("dashboard.title"), href: "/", icon: IconHome },
    ...modules,
    { key: "account", label: t("nav.account"), href: "/account", icon: IconUserCircle },
    { key: "settings", label: t("nav.settings"), href: "/settings", icon: IconSettings },
    ...(input.isAdmin
      ? [{ key: "admin", label: t("nav.adminSettings"), group: t("nav.admin"), href: "/admin/settings", icon: IconShield }]
      : []),
  ]
}

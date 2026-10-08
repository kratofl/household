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
  BudgetViewMenu,
  MobileTabBar,
  Sidebar,
  SidebarGroupLabel,
  SidebarLink,
  SidebarModuleNav,
  moduleIcons,
  useSidebarCollapsed,
} from "@/components/app/sidebar"
import { SearchField, SearchTab, type SearchDestination } from "@/components/app/global-search"
import { ProfileMenu } from "@/components/app/profile-menu"
import { Toast, ToastContext } from "@/components/app/toast"
import { ToolbarContent, ToolbarFrame } from "@/components/app/toolbar"
import { AccountPanel } from "@/features/account/account-panel"
import { AdminSettingsPanel } from "@/features/admin/admin-settings-panel"
import { SettingsPanel } from "@/features/settings/settings-panel"
import type { AuditEvent, UserChange } from "@/features/admin/types"
import { LoginScreen } from "@/features/auth/login-screen"
import { OIDC_CALLBACK_PATH, completeOidc, loadOidcOffer, startOidc, type OidcOffer } from "@/features/auth/oidc"
import { DashboardPanel } from "@/features/dashboard/module-panel"
import { errorMessage } from "@/lib/error-message"
import { LOCALE_STORAGE_KEY, TOKENS_STORAGE_KEY, registerSession } from "@/lib/session"
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
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [users, setUsers] = useState<CurrentUser[]>([])
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
  const [oidcOffer, setOidcOffer] = useState<OidcOffer>({ enabled: false, name: null })
  // A notice raised right before navigating (the OIDC callback hands off to another page) would be
  // cleared by the route change; it is shown on the next page instead.
  const carriedNotice = useRef<{ message?: string; error?: string } | null>(null)
  // The toast calls this after its few seconds; stable so its timer is not reset on every render.
  const clearMessage = useCallback(() => setMessage(null), [])

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
      setError(carriedNotice.current?.error ?? null)
      setMessage(carriedNotice.current?.message ?? null)
      carriedNotice.current = null
    }, 0)

    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    void loadOidcOffer().then(setOidcOffer)
  }, [])

  // Back from the OIDC provider: a sign-in leaves a fresh token pair in storage for the hydration
  // below, a link keeps the session that is already there. The effect below reruns (locale load,
  // strict mode), and the callback can only be spent once, so every run awaits the same attempt.
  const oidcFinish = useRef<Promise<void> | null>(null)
  const finishOidc = useCallback(async () => {
    try {
      const result = await completeOidc(new URLSearchParams(window.location.search))
      if (result.kind === "signedIn") window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(result.tokens))
      if (result.kind === "linked") carriedNotice.current = { message: t("account.oidcLinkDone") }
      if (result.kind === "rejected") carriedNotice.current = { error: t("auth.oidcRejected") }
      router.replace(result.kind === "linked" ? "/account" : "/")
    } catch (err) {
      carriedNotice.current = { error: errorMessage(err, t) }
      router.replace("/")
    }
  }, [router, t])

  useEffect(() => {
    void (async () => {
      if (window.location.pathname === OIDC_CALLBACK_PATH) {
        oidcFinish.current ??= finishOidc()
        await oidcFinish.current
      }
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
  }, [finishOidc, hydrateSession])

  useEffect(() => {
    if (!currentUser) return

    staticRoutes.forEach((route) => {
      router.prefetch(route)
    })
  }, [currentUser, router, staticRoutes])

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

  // Registrations waiting for approval come first; the rest stay in the API's name order.
  const loadUsers = useCallback(async () => {
    if (!tokens) return

    try {
      const list = await apiRequest<CurrentUser[]>("/users", { accessToken: tokens.accessToken })
      setUsers([...list.filter((user) => user.status === "pending"), ...list.filter((user) => user.status !== "pending")])
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }, [t, tokens])

  useEffect(() => {
    if (!isAdminSettings || currentUser?.role !== "admin") return

    const timer = window.setTimeout(() => void loadUsers(), 0)
    return () => window.clearTimeout(timer)
  }, [currentUser?.role, isAdminSettings, loadUsers])

  useEffect(() => {
    if (!isAdminSettings || currentUser?.role !== "admin" || !tokens) return

    const timer = window.setTimeout(() => {
      if (auditEvents.length === 0) {
        void loadAuditEvents(false)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [auditEvents.length, currentUser?.role, isAdminSettings, loadAuditEvents, tokens])

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

  async function loginWithOidc() {
    setError(null)
    setMessage(null)
    try {
      await startOidc()
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function linkOidc() {
    if (!tokens) return
    setError(null)
    setMessage(null)
    try {
      await startOidc(tokens.accessToken)
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function unlinkOidc() {
    if (!tokens) return
    setError(null)
    setMessage(null)
    try {
      await apiRequest("/users/me/oidc", { method: "DELETE", accessToken: tokens.accessToken })
      setCurrentUser((user) => (user ? { ...user, oidcLinked: false } : user))
      setMessage(t("account.oidcUnlinkDone"))
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
    setAuditEvents([])
    router.replace("/")
  }

  async function updateUser(user: CurrentUser, change: UserChange) {
    if (!tokens) return

    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/users/${user.id}`, { method: "PATCH", accessToken: tokens.accessToken, body: change })
      setMessage(t("users.updated", { name: user.name }))
    } catch (err) {
      setError(errorMessage(err, t))
    }
    await loadUsers()
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

  // Throwaway prototype routes render on their own, without session or chrome.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/prototype")) return children

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
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
        oidcName={oidcOffer.name}
        loginWithOidc={loginWithOidc}
        t={t}
      />
    )
  }

  const isAdmin = currentUser.role === "admin"
  const inBudget = selectedModule?.key === "budget"
  const budgetActive = activeModules.some((module) => module.key === "budget")
  const search = {
    destinations: destinationsFor({ activeModules, isAdmin, locale, t }),
    expensesHref: budgetActive ? budgetViews.expenses.route : undefined,
    t,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-label">
      <Sidebar
        appName={t("app.name")}
        collapsed={collapsed}
        toggle={toggleSidebar}
        collapseLabel={t("nav.collapseSidebar")}
        expandLabel={t("nav.expandSidebar")}
        navLabel={t("nav.main")}
        footer={<ProfileMenu name={currentUser.name} collapsed={collapsed} logout={logout} t={t} />}
      >
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
            <SidebarLink collapsed={collapsed} href="/admin/settings" active={isAdminSettings} icon={<IconShield />}>
              {t("nav.adminSettings")}
            </SidebarLink>
          </>
        ) : null}
      </Sidebar>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <ToastContext.Provider value={setMessage}>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <ToolbarFrame
              leading={inBudget ? <BudgetViewMenu pathname={pathname} t={t} /> : null}
              search={<SearchField {...search} />}
            >
              <div className="space-y-4 px-6 pt-6 pb-10 max-lg:px-5 max-lg:pt-5 max-lg:pb-32">
                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t("error.title")}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
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
                      oidcName={oidcOffer.name}
                      linkOidc={linkOidc}
                      unlinkOidc={unlinkOidc}
                      t={t}
                    />
                  ) : isSettings ? (
                    <SettingsPanel locale={locale} setLocale={setLocale} t={t} />
                  ) : isAdminSettings ? (
                    <AdminSettingsPanel
                      currentUser={currentUser}
                      modules={modules}
                      locale={locale}
                      toggleModule={toggleModule}
                      users={users}
                      updateUser={updateUser}
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
                    <>
                      <ToolbarContent title={t("dashboard.title")} />
                      <Card>
                        <CardHeader>
                          <CardTitle>{t("dashboard.inactiveTitle")}</CardTitle>
                          <CardDescription>{t("dashboard.inactiveDescription")}</CardDescription>
                        </CardHeader>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </ToolbarFrame>
          </main>
        </ToastContext.Provider>

        {/* Toasts sit at the bottom centre of the content area, above the phone tab bar. */}
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4 max-lg:bottom-[96px]">
          {message ? <Toast key={message} message={message} onDismiss={clearMessage} /> : null}
        </div>
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
        search={<SearchTab {...search} />}
        t={t}
      />
    </div>
  )
}

function selectedSectionFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? ""
}

/**
 * Everything the search can jump to, in sidebar order: the dashboard,
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

"use client"

import { IconRefresh } from "@tabler/icons-react"
import type { Locale, Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"
import { StatusDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsBlock, SettingsRow, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import { ToolbarContent } from "@/components/app/toolbar"
import { Switch } from "@/components/ui/switch"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

import type { AuditEvent, UserChange } from "@/features/admin/types"

// The admin pages, one per sidebar entry under Admin. The app shell renders the one for the
// current route and owns their data; these only render it and raise intent.

/** Shown on every admin page to someone without the admin role. */
export function AdminForbidden({ t }: { t: Translator }) {
  return (
    <>
      <ToolbarContent title={t("nav.admin")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.forbiddenTitle")}</CardTitle>
          <CardDescription>{t("admin.forbiddenDescription")}</CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}

const statusDot = { pending: "yellow", active: "green", blocked: "red" } as const

/**
 * Every account of the household. Registrations waiting for approval get their own list on top;
 * the admin's own account has no actions, so nobody locks themselves out.
 */
export function AdminUsersPage(props: {
  currentUser: CurrentUser
  users: CurrentUser[]
  updateUser: (user: CurrentUser, change: UserChange) => Promise<void>
  t: Translator
}) {
  const pending = props.users.filter((user) => user.status === "pending")
  const accounts = props.users.filter((user) => user.status !== "pending")
  return (
    <SettingsSurface title={props.t("nav.adminUsers")} description={props.t("users.description")}>
      {pending.length > 0 ? (
        <SettingsSection title={props.t("users.pendingTitle")} description={props.t("users.pendingDescription")}>
          {pending.map((user) => (
            <UserRow key={user.id} user={user} t={props.t}>
              <Button size="sm" onClick={() => props.updateUser(user, { status: "active" })}>
                {props.t("users.activate")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => props.updateUser(user, { status: "blocked" })}>
                {props.t("users.reject")}
              </Button>
            </UserRow>
          ))}
        </SettingsSection>
      ) : null}

      <SettingsSection title={props.t("users.accountsTitle")} description={props.t("users.accountsDescription")}>
        {accounts.map((user) =>
          user.id === props.currentUser.id ? (
            <UserRow key={user.id} user={user} own t={props.t} />
          ) : user.status === "blocked" ? (
            <UserRow key={user.id} user={user} t={props.t}>
              <Button size="sm" variant="secondary" onClick={() => props.updateUser(user, { status: "active" })}>
                {props.t("users.unblock")}
              </Button>
            </UserRow>
          ) : (
            <UserRow key={user.id} user={user} t={props.t}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => props.updateUser(user, { role: user.role === "admin" ? "user" : "admin" })}
              >
                {props.t(user.role === "admin" ? "users.removeAdmin" : "users.makeAdmin")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => props.updateUser(user, { status: "blocked" })}>
                {props.t("users.block")}
              </Button>
            </UserRow>
          ),
        )}
      </SettingsSection>
    </SettingsSurface>
  )
}

function UserRow(props: { user: CurrentUser; own?: boolean; t: Translator; children?: React.ReactNode }) {
  return (
    <SettingsRow
      title={props.own ? props.t("users.you", { name: props.user.name }) : props.user.name}
      description={`${props.user.email} · ${props.t(props.user.role === "admin" ? "users.roleAdmin" : "users.roleUser")}`}
    >
      <StatusDot status={statusDot[props.user.status]} className="text-footnote">
        {props.t(`users.status.${props.user.status}`)}
      </StatusDot>
      {props.children}
    </SettingsRow>
  )
}

export function AdminServicesPage(props: {
  modules: AppModule[]
  locale: Locale
  toggleModule: (module: AppModule, active: boolean) => Promise<void>
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("nav.adminServices")} description={props.t("services.description")}>
      <SettingsSection title={props.t("services.modulesTitle")} description={props.t("services.catalogHint")}>
        {props.modules.map((module) => (
          <SettingsRow
            key={module.id}
            title={moduleName(module, props.locale)}
            description={`${moduleDescription(module, props.locale)} · ${
              module.enabled ? props.t("services.available") : props.t("services.unavailable")
            }`}
          >
            <Switch
              checked={module.enabled && module.active}
              disabled={!module.enabled}
              onCheckedChange={(checked) => props.toggleModule(module, checked)}
              aria-label={props.t("services.switchLabel", {
                name: moduleName(module, props.locale),
              })}
            />
          </SettingsRow>
        ))}
      </SettingsSection>
    </SettingsSurface>
  )
}

export function AdminAuditPage(props: {
  auditEvents: AuditEvent[]
  loadAuditEvents: (showMessage?: boolean) => Promise<void>
  locale: Locale
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("nav.adminAudit")} description={props.t("audit.description")}>
      <SettingsSection
        title={props.t("audit.eventsTitle")}
        aside={
          <Button variant="secondary" size="sm" onClick={() => props.loadAuditEvents()}>
            <IconRefresh />
            {props.t("audit.load")}
          </Button>
        }
      >
        {props.auditEvents.length === 0 ? (
          <SettingsBlock className="text-label-secondary">{props.t("audit.empty")}</SettingsBlock>
        ) : (
          props.auditEvents.map((event) => (
            <div key={event.id} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{event.action}</p>
                <p className="text-footnote text-label-secondary">
                  {event.module} ·{" "}
                  {new Date(event.occurredAt).toLocaleString(props.locale === "de" ? "de-DE" : "en-US")} ·{" "}
                  {event.actorRole || props.t("audit.systemActor")}
                </p>
                {event.errorCode ? <p className="text-footnote text-danger-text">{event.errorCode}</p> : null}
              </div>
              <StatusDot status={event.outcome === "success" ? "green" : "red"} className="text-footnote">
                {event.outcome}
              </StatusDot>
            </div>
          ))
        )}
      </SettingsSection>
    </SettingsSurface>
  )
}

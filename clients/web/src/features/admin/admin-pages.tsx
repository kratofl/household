"use client"

import { useState } from "react"
import { IconDots, IconRefresh, IconShieldCheck, IconShieldOff, IconUserCheck, IconUserOff, IconUserPlus } from "@tabler/icons-react"
import type { Locale, Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"
import { StatusDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { FormSheet } from "@/components/app/form-sheet"
import { listCardClass } from "@/components/app/grouped"
import { PageHeader } from "@/components/app/page-header"
import {
  SettingsEmpty,
  SettingsRow,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSurface,
} from "@/components/app/settings-surface"
import { ToolbarButton, ToolbarGroup } from "@/components/app/toolbar"
import { Switch } from "@/components/ui/switch"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

import type { AuditEvent, CreateUserResult, NewUser, UserChange } from "@/features/admin/types"

// The admin pages, one per sidebar entry under Admin. The app shell renders the one for the
// current route and owns their data; these only render it and raise intent.

/** Shown on every admin page to someone without the admin role. */
export function AdminForbidden({ t }: { t: Translator }) {
  return (
    <SettingsSurface title={t("nav.admin")}>
      <SettingsSection title={t("admin.forbiddenTitle")}>
        <SettingsEmpty>{t("admin.forbiddenDescription")}</SettingsEmpty>
      </SettingsSection>
    </SettingsSurface>
  )
}

const statusDot = { pending: "yellow", active: "green", blocked: "red" } as const

const emptyUser: NewUser = { name: "", email: "", password: "" }

/**
 * Every account of the household. Provider sign-ins waiting for approval get their own list on top;
 * the admin's own account has no actions, so nobody locks themselves out. "New account" in the
 * toolbar opens a sheet; it closes once `createUser` reports the account exists and shows the error otherwise.
 */
export function AdminUsersPage(props: {
  currentUser: CurrentUser
  users: CurrentUser[]
  updateUser: (user: CurrentUser, change: UserChange) => Promise<void>
  createUser: (user: NewUser) => Promise<CreateUserResult>
  t: Translator
}) {
  const [creating, setCreating] = useState(false)
  const pending = props.users.filter((user) => user.status === "pending")
  const accounts = props.users.filter((user) => user.status !== "pending")
  return (
    <SettingsSurface
      title={props.t("nav.adminUsers")}
      description={props.t("users.description")}
      primaryAction={{ label: props.t("users.new"), icon: <IconUserPlus />, onClick: () => setCreating(true) }}
    >
      {pending.length > 0 ? (
        <SettingsSection title={props.t("users.pendingTitle")} description={props.t("users.pendingDescription")}>
          {pending.map((user) => (
            <UserRow key={user.id} user={user} t={props.t}>
              <Button size="sm" variant="secondary" onClick={() => props.updateUser(user, { status: "active" })}>
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
          ) : (
            <UserRow key={user.id} user={user} t={props.t}>
              <UserActions user={user} updateUser={props.updateUser} t={props.t} />
            </UserRow>
          ),
        )}
      </SettingsSection>

      <CreateUserSheet open={creating} close={() => setCreating(false)} createUser={props.createUser} t={props.t} />
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

/** The "…" menu of another account: the role change, then blocking or unblocking last. */
function UserActions(props: {
  user: CurrentUser
  updateUser: (user: CurrentUser, change: UserChange) => Promise<void>
  t: Translator
}) {
  const { user, t } = props
  const label = t("users.actions", { name: user.name })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} title={label}>
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.status === "blocked" ? (
          <DropdownMenuItem onSelect={() => void props.updateUser(user, { status: "active" })}>
            <IconUserCheck />
            {t("users.unblock")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => void props.updateUser(user, { role: user.role === "admin" ? "user" : "admin" })}>
              {user.role === "admin" ? <IconShieldOff /> : <IconShieldCheck />}
              {t(user.role === "admin" ? "users.removeAdmin" : "users.makeAdmin")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void props.updateUser(user, { status: "blocked" })}>
              <IconUserOff />
              {t("users.block")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The create-account form in a sheet; the draft is emptied whenever the sheet closes. */
function CreateUserSheet(props: {
  open: boolean
  close: () => void
  createUser: (user: NewUser) => Promise<CreateUserResult>
  t: Translator
}) {
  const [draft, setDraft] = useState<NewUser>(emptyUser)
  const t = props.t

  return (
    <FormSheet
      open={props.open}
      title={t("users.createTitle")}
      description={t("users.createDescription")}
      submitLabel={t("users.create")}
      cancelLabel={t("users.cancel")}
      submit={() => props.createUser(draft)}
      close={() => {
        setDraft(emptyUser)
        props.close()
      }}
    >
      <Field label={t("auth.username")}>
        <Input autoComplete="off" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <Field label={t("auth.email")}>
        <Input
          type="email"
          autoComplete="off"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
        />
      </Field>
      <Field label={t("auth.password")}>
        <Input
          type="password"
          autoComplete="new-password"
          value={draft.password}
          onChange={(event) => setDraft({ ...draft, password: event.target.value })}
        />
      </Field>
    </FormSheet>
  )
}

export function AdminServicesPage(props: {
  modules: AppModule[]
  locale: Locale
  toggleModule: (module: AppModule, active: boolean) => Promise<void>
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("nav.adminServices")}>
      <SettingsSection title={props.t("services.modulesTitle")} description={props.t("services.description")}>
        {props.modules.length === 0 ? (
          <SettingsEmpty>{props.t("services.empty")}</SettingsEmpty>
        ) : (
          props.modules.map((module) => (
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
          ))
        )}
      </SettingsSection>
    </SettingsSurface>
  )
}

const auditHead = "h-9 px-4 text-left align-middle text-caption text-label-secondary"
const auditCell = "h-9 px-4 py-1.5 align-middle max-lg:h-12 max-lg:py-2.5"

/**
 * The audit log as a list page: one table card with the latest events, reload in the toolbar.
 * On phones the module, time and actor fold into a line under the event.
 */
export function AdminAuditPage(props: {
  auditEvents: AuditEvent[]
  loadAuditEvents: (showMessage?: boolean) => Promise<void>
  locale: Locale
  t: Translator
}) {
  const t = props.t
  const time = (value: string) =>
    new Date(value).toLocaleString(props.locale === "de" ? "de-DE" : "en-US", { dateStyle: "medium", timeStyle: "short" })
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.adminAudit")}
        actions={
          <ToolbarGroup>
            <ToolbarButton label={t("audit.load")} icon={<IconRefresh />} onClick={() => void props.loadAuditEvents()} />
          </ToolbarGroup>
        }
      />
      <section className={listCardClass}>
        <SettingsSectionHeader title={t("audit.eventsTitle")} description={t("audit.description")} />
        {props.auditEvents.length === 0 ? (
          <div className="border-t border-separator">
            <SettingsEmpty>{t("audit.empty")}</SettingsEmpty>
          </div>
        ) : (
          <table className="w-full border-t border-separator text-callout">
            <thead className="max-lg:sr-only">
              <tr className="border-b border-separator">
                <th scope="col" className={auditHead}>{t("audit.time")}</th>
                <th scope="col" className={auditHead}>{t("audit.event")}</th>
                <th scope="col" className={auditHead}>{t("audit.module")}</th>
                <th scope="col" className={auditHead}>{t("audit.actor")}</th>
                <th scope="col" className={auditHead}>{t("audit.outcome")}</th>
              </tr>
            </thead>
            <tbody className="hairline-rows">
              {props.auditEvents.map((event) => (
                <tr key={event.id}>
                  <td className={`${auditCell} whitespace-nowrap tabular-nums text-label-secondary max-lg:hidden`}>{time(event.occurredAt)}</td>
                  <td className={auditCell}>
                    <p className="font-medium">{event.action}</p>
                    <p className="text-footnote text-label-secondary lg:hidden">
                      {event.module} · {time(event.occurredAt)} · {event.actorRole || t("audit.systemActor")}
                    </p>
                    {event.errorCode ? <p className="text-footnote text-danger-text">{event.errorCode}</p> : null}
                  </td>
                  <td className={`${auditCell} text-label-secondary max-lg:hidden`}>{event.module}</td>
                  <td className={`${auditCell} text-label-secondary max-lg:hidden`}>{event.actorRole || t("audit.systemActor")}</td>
                  <td className={`${auditCell} text-right lg:text-left`}>
                    <StatusDot status={event.outcome === "success" ? "green" : "red"} className="text-footnote">
                      {t(event.outcome === "success" ? "audit.outcomeSuccess" : "audit.outcomeFailure")}
                    </StatusDot>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

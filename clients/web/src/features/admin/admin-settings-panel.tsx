"use client"

import { IconRefresh } from "@tabler/icons-react"
import type { Locale, Translator } from "@/lib/i18n"
import { StatusDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsBlock, SettingsRow, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import { ToolbarContent } from "@/components/app/toolbar"
import { Switch } from "@/components/ui/switch"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

import type { AuditEvent, UserChange } from "@/features/admin/types"
import { UsersSection } from "@/features/admin/users-section"
import type { CurrentUser } from "@/lib/session"

export function AdminSettingsPanel(props: {
  currentUser: CurrentUser
  modules: AppModule[]
  locale: Locale
  toggleModule: (module: AppModule, active: boolean) => Promise<void>
  users: CurrentUser[]
  updateUser: (user: CurrentUser, change: UserChange) => Promise<void>
  auditEvents: AuditEvent[]
  loadAuditEvents: (showMessage?: boolean) => Promise<void>
  t: Translator
}) {
  if (props.currentUser.role !== "admin") {
    return (
      <>
        <ToolbarContent title={props.t("admin.title")} />
        <Card>
          <CardHeader>
            <CardTitle>{props.t("admin.forbiddenTitle")}</CardTitle>
            <CardDescription>{props.t("admin.forbiddenDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </>
    )
  }

  return (
    <SettingsSurface title={props.t("admin.title")} description={props.t("admin.description")}>
      <UsersSection currentUser={props.currentUser} users={props.users} updateUser={props.updateUser} t={props.t} />

      <SettingsSection title={props.t("services.title")} description={props.t("services.description")}>
        <SettingsBlock className="text-footnote text-label-secondary">{props.t("services.catalogHint")}</SettingsBlock>
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

      <SettingsSection
        title={props.t("audit.title")}
        description={props.t("audit.description")}
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

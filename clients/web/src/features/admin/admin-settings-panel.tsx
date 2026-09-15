"use client"

import { IconCloudDownload, IconRefresh, IconSettings } from "@tabler/icons-react"
import type { Locale, Translator } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsRow, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import { Switch } from "@/components/ui/switch"
import { moduleDescription, moduleName, type AppModule } from "@/lib/modules"

import { moduleIcons } from "@/components/app/sidebar"
import type { AuditEvent, UpdateCandidate, UpdateStatus } from "@/features/admin/types"
import type { CurrentUser } from "@/lib/session"

export function AdminSettingsPanel(props: {
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

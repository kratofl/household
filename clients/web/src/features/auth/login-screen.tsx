"use client"

import { useState } from "react"
import { IconLogin2, IconUserCheck } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { Field } from "@/components/app/field"
import { HouseholdLogo } from "@/components/app/household-logo"
import { TabView } from "@/components/app/tab-view"
import type { Translator } from "@/lib/i18n"

export function LoginScreen(props: {
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
  const [mode, setMode] = useState<"login" | "register">("login")
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-label max-lg:p-5">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <HouseholdLogo className="mx-auto mb-3 size-20" />
          <h1 className="text-large-title">{props.title}</h1>
          <p className="mt-0.5 text-label-secondary">{props.subtitle}</p>
        </div>
        {props.error ? (
          <Alert variant="destructive">
            <AlertTitle>{props.t("error.title")}</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        ) : null}
        {props.message ? (
          <Alert variant="info">
            <AlertTitle>{props.t("status.title")}</AlertTitle>
            <AlertDescription>{props.message}</AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{props.t("auth.title")}</CardTitle>
            <CardDescription>{props.t("auth.description")}</CardDescription>
          </CardHeader>
          <TabView
            ariaLabel={props.t("auth.title")}
            className="w-full"
            value={mode}
            options={[
              { value: "login", label: props.t("auth.loginTab") },
              { value: "register", label: props.t("auth.registerTab") },
            ]}
            onChange={setMode}
          />
          {mode === "login" ? (
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
              <Button className="w-full" size="lg" type="submit">
                <IconLogin2 />
                {props.t("auth.login")}
              </Button>
            </form>
          ) : (
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
              <Button className="w-full" size="lg" type="submit">
                <IconUserCheck />
                {props.t("auth.register")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  )
}

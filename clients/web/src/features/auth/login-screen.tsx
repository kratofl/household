"use client"

import { IconLogin2, IconUserCheck } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Field } from "@/components/app/field"
import { HouseholdLogo } from "@/components/app/household-logo"
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
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <HouseholdLogo className="mx-auto mb-3 size-20" />
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">{props.title}</h1>
          <p className="mt-0.5 text-muted-foreground">{props.subtitle}</p>
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

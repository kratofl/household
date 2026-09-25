// PROTOTYPE ONLY. Three Liquid Glass takes on the Household logo, next to the
// current one, at the sizes the app really uses. Not reachable in production.

import { notFound } from "next/navigation"

import { LogoPrototype } from "./logo-prototype"

export default function LogoPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <LogoPrototype />
}

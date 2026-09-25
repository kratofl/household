// PROTOTYPE ONLY. Three takes on Liquid Glass for Household, switchable via
// ?variant=A|B|C: A is macOS 26 Tahoe, B is macOS 27 Golden Gate, C keeps
// Household's opaque chrome and uses 27 glass only on floating layers.
// Read-only sample data, no backend. Not reachable in production builds.

import { notFound } from "next/navigation"

import { GlassPrototype } from "./glass-prototype"

export default async function GlassPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const { variant } = await searchParams
  const key = typeof variant === "string" && ["A", "B", "C"].includes(variant) ? variant : "B"
  return <GlassPrototype variant={key} />
}

import { moduleCatalog } from "@/lib/modules"

const staticSections = [
  "account",
  "settings",
  ...Object.values(moduleCatalog).map((module) => module.route.slice(1)),
]

export const dynamicParams = false

export function generateStaticParams() {
  return staticSections.map((section) => ({ section }))
}

export default function SectionPage() {
  return null
}

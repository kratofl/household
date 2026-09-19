import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const catalogPath = fileURLToPath(new URL("../src/lib/i18n.ts", import.meta.url))
const source = readFileSync(catalogPath, "utf8")
const germanCatalog = source.match(
  /const de = \{(?<body>[\s\S]*?)\r?\n\}\s+as const\s+const en: Record<keyof typeof de, string> = \{/,
)

if (!germanCatalog?.groups?.body) {
  throw new Error("Could not find the German translation catalog")
}

const legitimateVowelPairs = /^(?:aktuell(?:e|en|er|es)?|finanzierungsquelle|manuelle|neue[ns]?|steuern)$/i

function usesAsciiUmlautSubstitution(value) {
  const words = value.match(/[A-Za-zÄÖÜäöüß]+/g) ?? []

  return words.some(
    (word) =>
      (/(?:ae|oe|ue)/i.test(word) && !legitimateVowelPairs.test(word)) ||
      /(?:gross|schliess)/i.test(word),
  )
}

const invalidEntries = germanCatalog.groups.body
  .split("\n")
  .flatMap((line) => {
    const entry = line.match(/^\s*"(?<key>[^"]+)":\s*"(?<value>[^"]*)",?$/)
    if (!entry?.groups) return []

    return usesAsciiUmlautSubstitution(entry.groups.value)
      ? [`${entry.groups.key}: ${entry.groups.value}`]
      : []
  })

if (invalidEntries.length > 0) {
  console.error("German translations contain ASCII umlaut substitutions:")
  for (const entry of invalidEntries) console.error(`- ${entry}`)
  process.exitCode = 1
}

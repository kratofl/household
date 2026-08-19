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

const asciiSubstitutions = [
  /aender/i,
  /abschliess|schliess/i,
  /auswaehl/i,
  /beitraeg/i,
  /bestaet/i,
  /faell/i,
  /fuer/i,
  /gehoer/i,
  /geschuetz/i,
  /groess/i,
  /guelt/i,
  /haendl/i,
  /hinzufueg/i,
  /hoech/i,
  /koenn/i,
  /laed/i,
  /loesch/i,
  /moeg/i,
  /naech/i,
  /noet/i,
  /oeff/i,
  /plaen/i,
  /pruef/i,
  /regelmaess/i,
  /spaet/i,
  /ueber/i,
  /unterstuetz/i,
  /verfueg/i,
  /waehr/i,
  /waehl/i,
  /zurueck/i,
]

const invalidEntries = germanCatalog.groups.body
  .split("\n")
  .flatMap((line) => {
    const entry = line.match(/^\s*"(?<key>[^"]+)":\s*"(?<value>[^"]*)",?$/)
    if (!entry?.groups) return []

    return asciiSubstitutions.some((pattern) => pattern.test(entry.groups.value))
      ? [`${entry.groups.key}: ${entry.groups.value}`]
      : []
  })

if (invalidEntries.length > 0) {
  console.error("German translations contain ASCII umlaut substitutions:")
  for (const entry of invalidEntries) console.error(`- ${entry}`)
  process.exitCode = 1
}

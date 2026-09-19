#!/usr/bin/env node
// Fetches merchant logos from Wikimedia Commons into clients/web/public/merchants.
//
// Run it by hand with `make merchant-logos`, never during a build: the result is committed,
// so an install ships exactly the files that were reviewed in a pull request and nothing
// depends on a third party being up.
//
// How a merchant is matched: search Wikidata by name, then keep only a candidate whose
// official website (P856) is on the domain we expect. Matching on the name alone returns
// the wrong company often enough to be dangerous, matching on the domain fails to nothing.
//
// What may be written: only a file under a licence we may redistribute, and only after it
// survives inspect(). SVG is executable content, so anything with a script, an event
// handler or a reference to another server is refused rather than cleaned up.

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const catalogPath = join(root, "clients/web/public/merchants/catalog.json")
const outputDir = join(root, "clients/web/public/merchants")
const lockPath = join(outputDir, "logos.lock.json")
const rejectedPath = join(outputDir, "logos.rejected.json")

const USER_AGENT = "household-merchant-logos/1.0 (self-hosted household budgeting app; contact: repository issues)"
const REQUEST_PAUSE_MS = 2500
const MAX_BYTES = 512 * 1024

/**
 * Widest a logo may be to earn a place in a square tile. Commons mostly holds wordmarks, and
 * a 7:1 wordmark drawn 28 pixels wide is four pixels tall and unreadable. Anything wider is
 * reported instead of written, and the merchant keeps its monogram on the brand colour.
 */
const MAX_ASPECT = 2.2

/** Licences that allow redistribution inside the shipped image. Anything else is skipped. */
const FREE_LICENCES = [
  /^public domain$/i,
  /^cc0/i,
  /^cc[ -]by([ -]sa)?([ -]\d(\.\d)?)?$/i,
  /^pd/i,
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Wikimedia throttles bulk callers, so back off and retry instead of losing the merchant. */
async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
  if (response.status === 429 || response.status === 503) {
    if (attempt > 4) throw new Error(`${response.status} nach ${attempt} Versuchen`)
    const after = Number(response.headers.get("retry-after"))
    await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : REQUEST_PAUSE_MS * 2 ** attempt)
    return fetchJson(url, attempt + 1)
  }
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return await response.json()
}

function api(host, params) {
  return fetchJson(`https://${host}/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`)
}

/**
 * The Wikidata item whose official website sits on one of the expected domains, or null.
 * Searching both languages widens the candidate list; the domain check narrows it back down,
 * so a wider search cannot produce a wrong match, only a found one.
 */
async function resolveItem(merchant) {
  const domains = merchant.domains ?? [merchant.domain]
  // A catalog entry may name its Wikidata item outright, for the handful the search cannot
  // rank: "Saturn" is a planet first and an electronics chain somewhere far down. The domain
  // is still checked, so a mistyped id yields nothing rather than the wrong logo.
  const candidates = merchant.wikidata ? [merchant.wikidata] : []
  for (const language of candidates.length > 0 ? [] : ["de", "en"]) {
    const found = await api("www.wikidata.org", {
      action: "wbsearchentities", search: merchant.name, language, uselang: language, limit: "10", type: "item",
    })
    for (const hit of found.search ?? []) if (!candidates.includes(hit.id)) candidates.push(hit.id)
    await sleep(REQUEST_PAUSE_MS)
  }
  if (candidates.length === 0) return null

  const entities = await api("www.wikidata.org", {
    action: "wbgetentities", ids: candidates.slice(0, 50).join("|"), props: "claims|labels", languages: "de|en",
  })
  for (const id of candidates) {
    const entity = entities.entities?.[id]
    const sites = (entity?.claims?.P856 ?? []).map((claim) => claim.mainsnak?.datavalue?.value ?? "")
    if (!sites.some((site) => domains.some((domain) => hostOf(site) === domain || hostOf(site).endsWith(`.${domain}`)))) continue
    const logo = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value
    return { id, label: entity?.labels?.de?.value ?? entity?.labels?.en?.value ?? id, logo: logo ?? null }
  }
  return null
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

/** Licence, author and download URL for a Commons file. */
async function commonsFile(title) {
  const data = await api("commons.wikimedia.org", {
    action: "query", prop: "imageinfo", iiprop: "extmetadata|url|size|mime", titles: `File:${title}`,
  })
  const page = Object.values(data.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info) return null
  const meta = info.extmetadata ?? {}
  // Commons repeats the same text in nested spans, so collapse a doubled value.
  const strip = (value) => {
    const text = String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    const half = text.slice(0, text.length / 2)
    return half && text === half + half ? half : text
  }
  return {
    licence: strip(meta.LicenseShortName?.value) || "unbekannt",
    restrictions: strip(meta.Restrictions?.value),
    artist: strip(meta.Artist?.value),
    url: info.url,
    descriptionUrl: info.descriptionurl,
    mime: info.mime,
    size: info.size,
  }
}

/**
 * Decides whether an SVG may be written. Refuses rather than repairs, so every accepted file
 * is one a human could have accepted too, and a refusal shows up in the report by name.
 */
export function inspect(svg) {
  const reasons = []
  if (!/<svg[\s>]/i.test(svg)) reasons.push("kein SVG-Wurzelelement")
  if (/<\s*script/i.test(svg)) reasons.push("enthält <script>")
  if (/\son[a-z]+\s*=/i.test(svg)) reasons.push("enthält einen Event-Handler")
  if (/<\s*foreignObject/i.test(svg)) reasons.push("enthält <foreignObject>")
  if (/<\s*(iframe|embed|object|audio|video)[\s>]/i.test(svg)) reasons.push("enthält eingebettete Fremdinhalte")
  if (/<!ENTITY/i.test(svg)) reasons.push("deklariert Entities")
  if (/javascript:/i.test(svg)) reasons.push("enthält eine javascript-URL")
  if (/@import/i.test(svg)) reasons.push("importiert ein Stylesheet")

  // Every reference has to stay inside the file. No remote <image>, no remote <use>.
  for (const match of svg.matchAll(/(?:xlink:)?href\s*=\s*"([^"]*)"/gi)) {
    if (!match[1].startsWith("#")) { reasons.push(`verweist nach außen: ${match[1].slice(0, 60)}`); break }
  }
  return { ok: reasons.length === 0, reasons, aspect: aspectOf(svg) }
}

/** Width divided by height, so a wordmark too wide for a square tile can be reported. */
function aspectOf(svg) {
  const viewBox = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)
  if (viewBox) {
    const [, , width, height] = viewBox[1].trim().split(/[\s,]+/).map(Number)
    if (width > 0 && height > 0) return Number((width / height).toFixed(2))
  }
  const width = /\bwidth\s*=\s*"([\d.]+)/i.exec(svg)
  const height = /\bheight\s*=\s*"([\d.]+)/i.exec(svg)
  if (width && height && Number(height[1]) > 0) return Number((Number(width[1]) / Number(height[1])).toFixed(2))
  return null
}

function licenceIsFree(licence) {
  return FREE_LICENCES.some((pattern) => pattern.test(licence))
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"))
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith("-"))
  const wanted = only.length > 0 ? catalog.filter((entry) => only.includes(entry.key)) : catalog
  await mkdir(outputDir, { recursive: true })

  const lock = {}
  const skipped = []
  for (const merchant of wanted) {
    const report = (state, detail, file) => {
      skipped.push({ key: merchant.key, name: merchant.name, state, detail, source: file?.descriptionUrl ?? null })
      console.log(`  ${state.padEnd(12)} ${merchant.key.padEnd(14)} ${detail}`)
    }
    try {
      const item = await resolveItem(merchant)
      await sleep(REQUEST_PAUSE_MS)
      if (!item) { report("ungeklärt", `keine Wikidata-Seite mit Domain ${(merchant.domains ?? [merchant.domain]).join(" oder ")}`); continue }
      if (!item.logo) { report("kein Logo", `${item.id} (${item.label}) führt kein P154`); continue }

      const file = await commonsFile(item.logo)
      await sleep(REQUEST_PAUSE_MS)
      if (!file) { report("nicht da", `Commons kennt ${item.logo} nicht`); continue }
      if (!licenceIsFree(file.licence)) { report("Lizenz", `${file.licence} erlaubt keine Weitergabe`); continue }
      if (file.mime !== "image/svg+xml") { report("kein SVG", `${file.mime}`); continue }
      if (file.size > MAX_BYTES) { report("zu groß", `${Math.round(file.size / 1024)} KB`); continue }

      const response = await fetch(file.url, { headers: { "User-Agent": USER_AGENT } })
      if (!response.ok) { report("Download", `${response.status}`); continue }
      const svg = await response.text()
      const verdict = inspect(svg)
      if (!verdict.ok) { report("UNSICHER", verdict.reasons.join("; "), file); continue }
      if (verdict.aspect && verdict.aspect > MAX_ASPECT) {
        report("zu breit", `${verdict.aspect}:1, im Quadrat unlesbar`, file); continue
      }

      await writeFile(join(outputDir, `${merchant.key}.svg`), svg)
      lock[merchant.key] = {
        name: merchant.name,
        wikidata: item.id,
        wikidataLabel: item.label,
        commonsFile: item.logo,
        licence: file.licence,
        restrictions: file.restrictions || null,
        artist: file.artist || null,
        source: file.descriptionUrl,
        sha256: createHash("sha256").update(svg).digest("hex"),
        bytes: Buffer.byteLength(svg),
        aspect: verdict.aspect,
      }
      const shape = verdict.aspect && verdict.aspect > 2.5 ? " (breit, schlecht für quadratische Kacheln)" : ""
      console.log(`  ok           ${merchant.key.padEnd(14)} ${file.licence}${shape}`)
      await sleep(REQUEST_PAUSE_MS)
    } catch (error) {
      report("Fehler", String(error.message ?? error))
    }
  }

  const previous = await readFile(lockPath, "utf8").then(JSON.parse).catch(() => ({}))
  const merged = Object.fromEntries(Object.entries({ ...previous, ...lock }).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(lockPath, `${JSON.stringify(merged, null, 2)}\n`)
  // Kept so the next run and a human can see what was found but not used, and go look at it.
  // Merged like the lock file, otherwise a run for a handful of keys wipes the record of
  // every other merchant. A key that succeeded this time drops out of the list.
  const priorRejections = await readFile(rejectedPath, "utf8").then(JSON.parse).catch(() => [])
  const rejections = [
    ...priorRejections.filter((entry) => !wanted.some((merchant) => merchant.key === entry.key)),
    ...skipped,
  ].sort((a, b) => a.key.localeCompare(b.key))
  await writeFile(rejectedPath, `${JSON.stringify(rejections, null, 2)}\n`)

  console.log(`\n${Object.keys(lock).length} von ${wanted.length} geholt, ${skipped.length} übersprungen.`)
  console.log(`Nachweise in ${lockPath.replace(`${root}/`, "")}. Bitte den Diff durchsehen, bevor du committest.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()

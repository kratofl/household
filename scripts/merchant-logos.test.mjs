// The gate that decides whether a downloaded SVG may be written into the web client.
// Run: node --test scripts/merchant-logos.test.mjs
//
// This is the one part of the logo pipeline that has to be right. Everything else costs a
// missing tile; this costs a script running on our own origin.

import assert from "node:assert/strict"
import { test } from "node:test"

import { inspect } from "./merchant-logos.mjs"

const wrap = (body, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${attributes}>${body}</svg>`

test("lässt ein gewöhnliches Logo durch", () => {
  const verdict = inspect(wrap('<path d="M0 0h24v24H0z" fill="#CC071E"/>'))
  assert.equal(verdict.ok, true)
  assert.deepEqual(verdict.reasons, [])
  assert.equal(verdict.aspect, 1)
})

test("verweigert ein SVG mit Skript", () => {
  const verdict = inspect(wrap("<script>fetch('https://example.invalid')</script>"))
  assert.equal(verdict.ok, false)
  assert.match(verdict.reasons.join(" "), /script/i)
})

test("verweigert einen Event-Handler", () => {
  assert.equal(inspect(wrap('<path onload="alert(1)" d="M0 0"/>')).ok, false)
  assert.equal(inspect(wrap('<path onclick="alert(1)" d="M0 0"/>')).ok, false)
})

test("verweigert eingebettetes HTML", () => {
  assert.equal(inspect(wrap('<foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject>')).ok, false)
  assert.equal(inspect(wrap('<iframe src="https://example.invalid"></iframe>')).ok, false)
})

test("verweigert eine Entity-Deklaration", () => {
  const bomb = '<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa">]>' + wrap("<text>&a;</text>")
  assert.equal(inspect(bomb).ok, false)
})

test("verweigert jeden Verweis auf einen fremden Server", () => {
  assert.equal(inspect(wrap('<image href="https://tracker.invalid/pixel.png"/>')).ok, false)
  assert.equal(inspect(wrap('<use xlink:href="https://elsewhere.invalid/sprite.svg#icon"/>')).ok, false)
  assert.equal(inspect(wrap('<a href="javascript:alert(1)"><path d="M0 0"/></a>')).ok, false)
})

test("erlaubt einen Verweis innerhalb derselben Datei", () => {
  assert.equal(inspect(wrap('<defs><linearGradient id="g"/></defs><use href="#g"/>')).ok, true)
})

test("verweigert ein importiertes Stylesheet", () => {
  assert.equal(inspect(wrap('<style>@import url("https://fonts.invalid/x.css");</style>')).ok, false)
})

test("verweigert etwas, das gar kein SVG ist", () => {
  assert.equal(inspect("<html><body>nope</body></html>").ok, false)
})

test("misst das Seitenverhältnis für die quadratische Kachel", () => {
  const withViewBox = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 599.81 208.4"><path d="M0 0"/></svg>'
  assert.equal(inspect(withViewBox).aspect, 2.88)
  const withoutViewBox = '<svg xmlns="http://www.w3.org/2000/svg" width="167.21" height="24.09"><path d="M0 0"/></svg>'
  assert.equal(inspect(withoutViewBox).aspect, 6.94)
  assert.equal(inspect('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>').aspect, null)
})

"use client"

// The search in the middle of the topbar. It finds places in the app by name and,
// while Budget is active, hands any other term to the expense search
// (/budget/expenses?q=…). ⌘K or Ctrl+K focuses it from anywhere; arrow keys move
// through the results, Enter opens one, Escape closes the list.

import { IconSearch, type Icon } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"

import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type SearchDestination = { key: string; label: string; group?: string; href: string; icon: Icon }

type Result = SearchDestination

/** Places whose name or group contains the term, then the expense search for that term. */
function results(term: string, destinations: SearchDestination[], expensesHref: string | undefined, t: Translator): Result[] {
  const query = term.trim()
  const needle = query.toLocaleLowerCase()
  const places = needle
    ? destinations.filter(
        (destination) =>
          destination.label.toLocaleLowerCase().includes(needle) || destination.group?.toLocaleLowerCase().includes(needle),
      )
    : destinations
  const expenses: Result[] =
    query && expensesHref
      ? [{ key: "search.expenses", label: t("search.inExpenses", { term: query }), href: `${expensesHref}?q=${encodeURIComponent(query)}`, icon: IconSearch }]
      : []
  return [...places.slice(0, 8), ...expenses]
}

function noopSubscribe() {
  return () => {}
}

export function GlobalSearch({
  destinations,
  expensesHref,
  t,
}: {
  destinations: SearchDestination[]
  /** Where expense search lives; absent while Budget is inactive. */
  expensesHref?: string
  t: Translator
}) {
  const router = useRouter()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const isMac = useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false)

  const list = open ? results(term, destinations, expensesHref, t) : []
  const selected = Math.min(active, Math.max(0, list.length - 1))

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function go(result: Result) {
    setOpen(false)
    setTerm("")
    input.current?.blur()
    router.push(result.href)
  }

  return (
    <div className="relative w-full">
      <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label={t("search.label")}
        aria-expanded={open && list.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && list.length > 0 ? `${listId}-${selected}` : undefined}
        autoComplete="off"
        placeholder={t("search.placeholder")}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActive((selected + 1) % Math.max(1, list.length))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((selected - 1 + list.length) % Math.max(1, list.length))
          } else if (event.key === "Enter" && list[selected]) {
            event.preventDefault()
            go(list[selected])
          } else if (event.key === "Escape") {
            setOpen(false)
            input.current?.blur()
          }
        }}
        className="h-8 w-full rounded-full bg-fill-3 pr-14 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 font-sans text-[11px] text-muted-foreground sm:block">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t("search.label")}
          className="glass-strong absolute top-[calc(100%+8px)] right-0 left-0 z-50 max-h-80 origin-top overflow-y-auto p-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-[var(--motion-panel)] motion-reduce:animate-none"
        >
          {list.length === 0 ? (
            <p className="px-2.5 py-2 text-muted-foreground">{t("search.empty")}</p>
          ) : (
            list.map((result, index) => {
              const Glyph = result.icon
              return (
                <div
                  key={result.key}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === selected}
                  // Keeps focus in the input, so blur does not close the list before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                  className={cn(
                    "flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5",
                    index === selected ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  <Glyph className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  {result.group ? (
                    <span className={cn("shrink-0 text-[11px]", index === selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {result.group}
                    </span>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}

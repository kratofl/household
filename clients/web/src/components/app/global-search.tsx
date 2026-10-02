"use client"

// The app-wide search. It finds places in the app by name and, while Budget is
// active, hands any other term to the expense search (/budget/expenses?q=…).
// On desktop it is the pill search field at the end of the toolbar; ⌘K or
// Ctrl+K focuses it from anywhere. On phones it is a separate search tab next to
// the tab bar that opens the same field above it. Arrow keys move through the
// results, Enter opens one, Escape closes the list.

import { IconSearch, type Icon } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"

import { menuContentClass } from "@/components/ui/dropdown-menu"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type SearchDestination = { key: string; label: string; group?: string; href: string; icon: Icon }

type SearchProps = {
  destinations: SearchDestination[]
  /** Where expense search lives; absent while Budget is inactive. */
  expensesHref?: string
  t: Translator
}

/** Places whose name or group contains the term, then the expense search for that term. */
function results(term: string, destinations: SearchDestination[], expensesHref: string | undefined, t: Translator): SearchDestination[] {
  const query = term.trim()
  const needle = query.toLocaleLowerCase()
  const places = needle
    ? destinations.filter(
        (destination) =>
          destination.label.toLocaleLowerCase().includes(needle) || destination.group?.toLocaleLowerCase().includes(needle),
      )
    : destinations
  const expenses: SearchDestination[] =
    query && expensesHref
      ? [{ key: "search.expenses", label: t("search.inExpenses", { term: query }), href: `${expensesHref}?q=${encodeURIComponent(query)}`, icon: IconSearch }]
      : []
  return [...places.slice(0, 8), ...expenses]
}

function noopSubscribe() {
  return () => {}
}

/**
 * The field and its result list. `above` opens the list upward, for the phone
 * panel that sits at the bottom of the screen.
 */
function SearchBox({
  destinations,
  expensesHref,
  t,
  above = false,
  autoFocus = false,
  shortcut = false,
  onDone,
  className,
}: SearchProps & { above?: boolean; autoFocus?: boolean; shortcut?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(autoFocus)
  const [active, setActive] = useState(0)
  const isMac = useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false)

  const list = open ? results(term, destinations, expensesHref, t) : []
  const selected = Math.min(active, Math.max(0, list.length - 1))

  useEffect(() => {
    if (!shortcut) return
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shortcut])

  function close() {
    setOpen(false)
    onDone?.()
  }

  function go(result: SearchDestination) {
    setTerm("")
    input.current?.blur()
    close()
    router.push(result.href)
  }

  return (
    <div className={cn("relative", className)}>
      <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-label-secondary [stroke-width:2]" />
      <input
        ref={input}
        type="search"
        role="combobox"
        autoFocus={autoFocus}
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
        onBlur={close}
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
            input.current?.blur()
          }
        }}
        className={cn(
          "h-10 w-full rounded-full bg-fill pl-9 text-callout text-label placeholder:text-label-secondary in-[.toolbar-band]:bg-toolbar-fill max-lg:h-11 [&::-webkit-search-cancel-button]:hidden",
          shortcut ? "pr-14" : "pr-4",
        )}
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-surface px-2 py-0.5 font-sans text-caption font-medium text-label-secondary">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      ) : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t("search.label")}
          className={cn(
            menuContentClass,
            "absolute right-0 left-0 max-h-80 min-w-0",
            above ? "bottom-[calc(100%+8px)] origin-bottom" : "top-[calc(100%+8px)] origin-top",
          )}
        >
          {list.length === 0 ? (
            <p className="px-2.5 py-2 text-footnote text-label-secondary">{t("search.empty")}</p>
          ) : (
            list.map((result, index) => {
              const Glyph = result.icon
              const highlighted = index === selected
              return (
                <div
                  key={result.key}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={highlighted}
                  // Keeps focus in the input, so blur does not close the list before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                  className={cn(
                    "flex h-[30px] cursor-default items-center gap-2 rounded-sm px-2.5 text-footnote font-medium max-lg:h-12 max-lg:rounded-full max-lg:px-4 max-lg:text-callout",
                    highlighted ? "bg-brand-500 text-on-brand" : "text-label",
                  )}
                >
                  <Glyph className="size-4 shrink-0 [stroke-width:2]" />
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  {result.group ? (
                    <span className={cn("shrink-0 text-caption font-normal", highlighted ? "text-on-brand/75" : "text-label-secondary")}>
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

/** The search field at the end of the desktop toolbar. */
export function SearchField(props: SearchProps) {
  return <SearchBox {...props} shortcut className="w-60 max-lg:hidden xl:w-72" />
}

/** The phone's search tab: a round glass button beside the tab bar that opens the field above it. */
export function SearchTab(props: SearchProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <>
      {open ? (
        <div className="fixed inset-x-4 bottom-[92px] z-30 lg:hidden">
          <SearchBox {...props} above autoFocus onDone={() => {
              setOpen(false)
              // The panel unmounts with the field; focus goes back to the tab that opened it.
              button.current?.focus()
            }} className="glass rounded-full [&_input]:bg-transparent" />
        </div>
      ) : null}
      <button
        ref={button}
        type="button"
        aria-label={props.t("search.label")}
        aria-expanded={open}
        // While open, keeps focus in the field so its blur does not close the panel before this click toggles it.
        onMouseDown={(event) => { if (open) event.preventDefault() }}
        onClick={() => setOpen((value) => !value)}
        className={cn("glass grid size-[60px] shrink-0 place-items-center rounded-full", open ? "text-brand-500" : "text-label")}
      >
        <IconSearch className="size-6" />
      </button>
    </>
  )
}

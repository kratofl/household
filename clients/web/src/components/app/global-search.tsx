"use client"

// The app-wide search. It finds places in the app by name and, while Budget is
// active, hands any other term to the expense search (/budget/expenses?q=…).
// On desktop it is the pill search field at the end of the toolbar; ⌘K or
// Ctrl+K focuses it from anywhere. On phones it is a separate search tab next to
// the tab bar that opens the same field above it. Arrow keys move through the
// results, Enter opens one, Escape closes the list (a combobox, components/ui/command).

import { IconSearch, type Icon } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { Command, CommandEmpty, CommandHint, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
  const input = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(autoFocus)
  const isMac = useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false)

  const list = open ? results(term, destinations, expensesHref, t) : []

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

  // Results are listed only while the field has focus, so the field is never collapsed
  // while it is in use (cmdk always reports it expanded).
  return (
    <Command shouldFilter={false} loop label={t("search.label")} className={cn("relative", className)}>
      <CommandInput
        ref={input}
        autoFocus={autoFocus}
        aria-label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={term}
        onValueChange={(value) => {
          setTerm(value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") input.current?.blur()
        }}
        inputClassName={shortcut ? "pr-12" : "pr-4"}
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xs border border-separator px-1 font-sans text-caption font-medium text-label-secondary">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      ) : null}

      {open ? (
        <CommandList
          className={cn(
            menuContentClass,
            "absolute right-0 left-0 max-h-80 min-w-0",
            above ? "bottom-[calc(100%+8px)] origin-bottom" : "top-[calc(100%+8px)] origin-top",
          )}
        >
          <CommandEmpty>{t("search.empty")}</CommandEmpty>
          {list.map((result) => {
            const Glyph = result.icon
            return (
              <CommandItem
                key={result.key}
                value={result.key}
                // Keeps focus in the input, so blur does not close the list before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onSelect={() => go(result)}
              >
                <Glyph />
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                {result.group ? <CommandHint>{result.group}</CommandHint> : null}
              </CommandItem>
            )
          })}
        </CommandList>
      ) : null}
    </Command>
  )
}

/** The search field at the end of the desktop toolbar. */
export function SearchField(props: SearchProps) {
  return <SearchBox {...props} shortcut className="w-56 max-lg:hidden xl:w-64" />
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

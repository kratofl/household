"use client"

import { useId, useRef, useState } from "react"
import { Popover } from "radix-ui"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { FormSelectOption } from "./form-select"

/** Searchable single selection; typing filters options without changing the saved value. */
export function SearchableSelect({ id, value, options, onValueChange, searchLabel, emptyLabel, className, disabled }: {
  id: string; value: string; options: FormSelectOption[]; onValueChange: (value: string) => void
  searchLabel: string; emptyLabel: string; className?: string; disabled?: boolean
}) {
  const listId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
  const filtered = options.filter(option => normalize(option.label).includes(normalize(query.trim())))
  const select = (option: FormSelectOption) => { onValueChange(option.value); setOpen(false) }
  const move = (index: number) => {
    setActive(index)
    document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" })
  }
  return (
    <Popover.Root open={open} onOpenChange={next => { setOpen(next); setQuery(""); setActive(0) }}>
      <Popover.Trigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} className={cn("justify-between gap-2 border-border-control", className)}>
          <span className="truncate">{options.find(option => option.value === value)?.label}</span><IconChevronDown />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={searchLabel} align="end" sideOffset={6} onOpenAutoFocus={event => { event.preventDefault(); searchRef.current?.focus() }} className="glass z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-lg p-2">
          <Input ref={searchRef} role="combobox" aria-label={searchLabel} placeholder={searchLabel} aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={event => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                if (filtered.length) move((active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length)
              } else if (event.key === "Enter") {
                event.preventDefault()
                if (filtered[active]) select(filtered[active])
              }
            }} />
          <div id={listId} role="listbox" aria-label={searchLabel} className="mt-2 max-h-60 overflow-y-auto">
            {filtered.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value} onMouseDown={event => event.preventDefault()} onClick={() => select(option)} onMouseMove={() => setActive(index)} className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-callout lg:min-h-[26px] lg:px-2 lg:py-1", active === index && "bg-brand-500 text-on-brand")}>
              {option.label}{option.value === value ? <IconCheck className="size-4 shrink-0" /> : null}
            </div>)}
          </div>
          {filtered.length === 0 ? <p role="status" className="px-3 py-2 text-footnote text-label-secondary">{emptyLabel}</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

"use client"

import { useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { FormSelectOption } from "./form-select"

// cmdk ignores an empty item value, and callers use "" as a real option ("no merchant").
const itemValue = (value: string) => `option:${value}`
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()

/** Searchable single selection; typing filters options (ignoring accents) without changing the saved value. */
export function SearchableSelect({ id, value, options, onValueChange, searchLabel, emptyLabel, className, disabled }: {
  id: string; value: string; options: FormSelectOption[]; onValueChange: (value: string) => void
  searchLabel: string; emptyLabel: string; className?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filtered = options.filter(option => normalize(option.label).includes(normalize(query.trim())))
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); setQuery("") }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} className={cn("justify-between gap-2 border-border-control", className)}>
          <span className="truncate">{options.find(option => option.value === value)?.label}</span><IconChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={searchLabel} className="p-1 max-lg:p-1.5">
        <Command shouldFilter={false} loop label={searchLabel} defaultValue={itemValue(value)}>
          <CommandInput autoFocus placeholder={searchLabel} value={query} onValueChange={setQuery} className="p-1" />
          <CommandList className="mt-1">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {filtered.map(option => (
              <CommandItem key={option.value} value={itemValue(option.value)} checked={option.value === value} onSelect={() => { onValueChange(option.value); setOpen(false) }}>
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

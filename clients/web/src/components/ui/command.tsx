"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { IconCheck } from "@tabler/icons-react"

import { menuItemShapeClass } from "@/components/ui/dropdown-menu"
import { SearchFieldIcon, searchFieldClass } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// A combobox from DESIGN.md: a search field over a list of options that look like
// context-menu items. Arrow keys move the highlight (brand-500), Enter picks, the
// pointer highlights what it is over. Callers filter the options themselves
// (`shouldFilter={false}`), so the list is exactly what they render. Use it inside a
// popover for a searchable select, or inline for the app search.

// Ctrl+J/K/N/P stay with the browser and the app: Ctrl+K is the search shortcut.
function Command({ className, vimBindings = false, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" vimBindings={vimBindings} className={cn("text-label", className)} {...props} />
}

/** The search field of a combobox, with the magnifier on the left. `className` sizes the wrapper. */
function CommandInput({ className, inputClassName, ...props }: React.ComponentProps<typeof CommandPrimitive.Input> & { inputClassName?: string }) {
  return (
    <div className={cn("relative", className)}>
      <SearchFieldIcon />
      <CommandPrimitive.Input data-slot="command-input" className={cn(searchFieldClass, inputClassName)} {...props} />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("max-h-60 overflow-y-auto", className)} {...props} />
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className={cn("px-2.5 py-2 text-footnote text-label-secondary", className)} {...props} />
}

/** One option. `checked` marks the saved value with a check on the right, as in a select list. */
function CommandItem({ className, checked, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item> & { checked?: boolean }) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        menuItemShapeClass,
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:text-label-disabled data-[selected=true]:bg-brand-500 data-[selected=true]:text-on-brand",
        checked !== undefined && "pr-8",
        className
      )}
      {...props}
    >
      {children}
      {checked ? <IconCheck className="absolute right-2.5" /> : null}
    </CommandPrimitive.Item>
  )
}

/** Secondary text at the end of an item, e.g. the group a result belongs to. */
function CommandHint({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-hint"
      className={cn("ml-auto shrink-0 text-caption font-normal text-label-secondary group-data-[selected=true]/menu-item:text-on-brand/75", className)}
      {...props}
    />
  )
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandHint }

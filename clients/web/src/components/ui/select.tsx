"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"

import { menuContentClass, menuItemClass } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// The dropdown field from DESIGN.md: a 40px surface field with the value on the
// left and, on the right, an S secondary icon box with a chevron-down. The list
// opens as a context menu. Below lg the field is a 44px pill.

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-surface pr-[5px] pl-3 text-left text-callout text-label data-placeholder:text-label-secondary disabled:cursor-not-allowed disabled:bg-bg disabled:text-label-disabled aria-invalid:border-red-500 max-lg:h-11 max-lg:rounded-full max-lg:pr-[7px] max-lg:pl-4 [&>span:first-child]:truncate",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-sm bg-fill text-label max-lg:rounded-full">
          <IconChevronDown className="size-3 [stroke-width:2.6]" />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position="popper"
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          menuContentClass,
          "max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin)",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn(menuItemClass, "pr-8", className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="pointer-events-none absolute right-2.5 flex items-center">
        <SelectPrimitive.ItemIndicator>
          <IconCheck />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem }

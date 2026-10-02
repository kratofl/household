"use client"

// The frosted toolbar: one uniform band across the top of the content area,
// 64px tall, sticky, with content scrolling underneath. The leading group is the
// page title (title-2), the trailing group holds the page's icon actions and,
// last, the search. The shell renders the band; pages fill it with PageHeader,
// which portals the title and actions into the slots below, so a page declares
// its toolbar where it renders and its handlers stay live.
//
// Rules from DESIGN.md: icons over text, borderless icon actions in one pill
// group, a text-labelled action stands apart, nothing tinted or orange in here.

import { createContext, useContext, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

type Slots = { title: HTMLElement | null; actions: HTMLElement | null }

const ToolbarSlots = createContext<Slots>({ title: null, actions: null })

export function ToolbarFrame({
  leading,
  search,
  children,
}: {
  /** Extra controls right of the title, e.g. the phone's Budget view menu. */
  leading?: ReactNode
  search: ReactNode
  children: ReactNode
}) {
  const [title, setTitle] = useState<HTMLElement | null>(null)
  const [actions, setActions] = useState<HTMLElement | null>(null)
  return (
    <ToolbarSlots.Provider value={{ title, actions }}>
      <header className="toolbar-band sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 px-6 max-lg:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <div ref={setTitle} className="min-w-0" />
          {leading}
        </div>
        <div ref={setActions} className="flex shrink-0 items-center gap-2.5 empty:hidden" />
        {search}
      </header>
      {children}
    </ToolbarSlots.Provider>
  )
}

/** Puts a page's title and actions into the toolbar the shell renders. */
export function ToolbarContent({ title, actions }: { title: string; actions?: ReactNode }) {
  const slots = useContext(ToolbarSlots)
  return (
    <>
      {slots.title ? createPortal(<h1 className="truncate text-title-2">{title}</h1>, slots.title) : null}
      {actions && slots.actions ? createPortal(actions, slots.actions) : null}
    </>
  )
}

/** The pill that groups borderless icon actions. */
export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 rounded-full bg-toolbar-fill p-1 max-lg:p-0.5">{children}</div>
}

/**
 * A toolbar action. With an icon it is a borderless symbol and the label becomes
 * its accessible name and tooltip; put it in a ToolbarGroup. Without an icon it
 * is a text-labelled action on the toolbar fill, standing on its own.
 */
export function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  if (icon) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        disabled={disabled}
        className="grid h-8 w-9 place-items-center rounded-full text-label transition-colors hover:bg-toolbar-fill disabled:text-label-disabled max-lg:size-11 [&_svg]:size-[18px]"
      >
        {icon}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-full bg-toolbar-fill px-4 text-callout font-semibold whitespace-nowrap text-label transition-colors disabled:text-label-disabled max-lg:h-11"
    >
      {label}
    </button>
  )
}

"use client"

import type { ReactNode } from "react"

import { PageHeader } from "@/components/app/page-header"
import type { ToolbarPrimaryAction } from "@/components/app/toolbar"

// The Settings page type: the title, a one-line caption and the page's primary action
// in the toolbar, then one column of at most 720px of list cards (Group from grouped.tsx,
// with FormRow rows). Nothing sits between the cards.

export function SettingsSurface({
  title,
  description,
  primaryAction,
  children,
}: {
  title: string
  /** One line about the page: the toolbar caption beside the title (hidden on phones). */
  description?: string
  primaryAction?: ToolbarPrimaryAction
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <PageHeader title={title} caption={description} primaryAction={primaryAction} />
      {children}
    </div>
  )
}

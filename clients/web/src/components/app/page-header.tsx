import type { ReactNode } from "react"

// The row every page starts with: a large title, an optional line under it, and
// the page's actions on the right. Actions share the title's row, so a page
// never spends a whole row on a single button; on a phone they drop below the
// title only when they do not fit beside it, and then take the full width.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] lg:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {/* Sized by its one-line width, so it either fits beside the title or moves below it whole. */}
      {actions ? <div className="flex grow basis-[max-content] flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  )
}

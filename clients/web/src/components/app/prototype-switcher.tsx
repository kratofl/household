"use client"

// PROTOTYPE ONLY. Floating bar that flips between the variants of a throwaway
// prototype route via ?variant=. Arrow keys cycle too, except while typing or
// dragging a slider. Renders nothing in production builds.

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, type ReactNode } from "react"

export type PrototypeVariant = { key: string; name: string }

export function PrototypeSwitcher({
  variants,
  current,
  children,
}: {
  variants: PrototypeVariant[]
  current: string
  /** Extra prototype controls shown inside the bar, e.g. a slider. */
  children?: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const index = Math.max(0, variants.findIndex((variant) => variant.key === current))

  const go = useCallback(
    (step: number) => {
      const next = variants[(index + step + variants.length) % variants.length]
      const params = new URLSearchParams(searchParams.toString())
      params.set("variant", next.key)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [index, pathname, router, searchParams, variants],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      const target = event.target
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return
      go(event.key === "ArrowLeft" ? -1 : 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  if (process.env.NODE_ENV === "production") return null

  return (
    <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full bg-black px-1.5 py-1.5 text-[13px] text-white shadow-[0_8px_30px_rgb(0_0_0/0.35)] ring-1 ring-white/15">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous variant"
          className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/15"
        >
          <IconChevronLeft className="size-4" />
        </button>
        <span className="min-w-44 px-2 text-center font-medium tabular-nums">
          {variants[index].key} <span className="text-white/60">({variants[index].name})</span>
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next variant"
          className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/15"
        >
          <IconChevronRight className="size-4" />
        </button>
        {children ? <div className="flex items-center gap-3 border-l border-white/20 pr-2 pl-3">{children}</div> : null}
      </div>
    </div>
  )
}

"use client"

// A short-lived confirmation: a glass pill at the bottom centre of the content
// area with a status disc and one line. It dismisses itself after about four
// seconds; the shell positions it inside a persistent role="status" region, so
// screen readers announce it, and clears the message in onDismiss. Features raise
// one with useToast() instead of rendering their own.

import { IconCheck } from "@tabler/icons-react"
import { createContext, useContext, useEffect } from "react"

export const ToastContext = createContext<(message: string) => void>(() => {})

/** Shows a confirmation toast, e.g. after a save. */
export function useToast() {
  return useContext(ToastContext)
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      className="glass toast pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full py-2.5 pr-[18px] pl-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
    >
      <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-full bg-green-500 text-green-900">
        <IconCheck className="size-[13px] [stroke-width:3]" />
      </span>
      <span className="min-w-0 truncate text-[14px] font-semibold">{message}</span>
    </div>
  )
}

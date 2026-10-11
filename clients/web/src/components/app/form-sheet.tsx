"use client"

import { useState, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

/** What a form sheet's submit reports: done, so the sheet closes, or the message to show inside it. */
export type FormSheetResult = { ok: true } | { ok: false; message: string }

/**
 * A form in a solid sheet: title and description on top, the fields, then Cancel and the
 * submit action in the footer. A failed submit shows its message inside the sheet, since
 * the page behind it is covered. The error clears on resubmit and on close; a successful
 * submit closes the sheet through `close`. Focus starts on the first field.
 */
export function FormSheet(props: {
  open: boolean
  title: string
  description: string
  submitLabel: string
  cancelLabel: string
  /** Blocks submit, e.g. while a required field is empty. */
  submitDisabled?: boolean
  submit: () => Promise<FormSheetResult>
  close: () => void
  children: ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setError(null)
    props.close()
  }

  return (
    <Sheet open={props.open} onOpenChange={(open) => { if (!open && !pending) close() }}>
      <SheetContent>
        <div className="shrink-0 space-y-0.5 border-b border-separator px-4 py-3">
          <SheetTitle>{props.title}</SheetTitle>
          <SheetDescription>{props.description}</SheetDescription>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            setError(null)
            try {
              const result = await props.submit()
              if (result.ok) close()
              else setError(result.message)
            } finally {
              setPending(false)
            }
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {props.children}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-separator px-4 py-3">
            <Button type="button" variant="secondary" disabled={pending} onClick={close}>
              {props.cancelLabel}
            </Button>
            <Button type="submit" disabled={pending || props.submitDisabled}>
              {props.submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Takes no space until there is an error to show. The status is announced to screen readers
 * only, so frequent progress updates (like the plan preview) never move the fields.
 */
export function FormFeedback({ error, status }: { error?: string | null; status?: string | null }) {
  return (
    <div className={error ? undefined : "sr-only"} aria-live="polite" aria-atomic="true">
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        : status ? <p role="status">{status}</p> : null}
    </div>
  )
}

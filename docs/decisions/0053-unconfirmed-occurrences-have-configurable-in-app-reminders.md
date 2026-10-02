# ADR 0053: Unconfirmed Occurrences Have Configurable In-App Reminders

- Status: Accepted
- Date: 2026-07-16

## Context

Expected occurrences that require manual confirmation can otherwise remain
unresolved and make actual reporting incomplete. Not every plan needs the same
reminder behavior, and automatically posted plans require no confirmation prompt.

## Decision

Each recurring plan that requires confirmation may configure in-app reminders,
including a reminder on its due date and an optional overdue reminder.

Automatically posted occurrences do not produce confirmation reminders. Email,
push, messenger, and other external delivery channels are outside the current
Budget completion scope.

## Consequences

- The application has an in-app area for due and overdue Budget actions.
- Confirming, skipping, voiding, or otherwise resolving an occurrence clears its
  outstanding reminder.
- Reminder configuration changes apply prospectively.
- A plan can disable reminders without enabling automatic posting.
- Overdue status remains visible in the transaction timeline even when reminders
  are disabled.

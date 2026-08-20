# ADR 0007: Automatic Posting Is Configured Per Plan

- Status: Accepted
- Date: 2026-07-14

## Context

Recurring plans produce expected occurrences. Some occurrences are predictable
enough to become actual transactions automatically, while others may arrive on a
different date or for a different amount and need user confirmation.

A single global switch cannot safely express both cases.

## Decision

Automatic posting is configured independently on each recurring plan.

The default for a new plan is to require user confirmation. When automatic
posting is enabled for a plan, its eligible expected occurrences become actual
transactions according to the effective plan version without manual action.

## Consequences

- A user can automate stable plans while manually confirming variable ones.
- Automatically posted and manually confirmed transactions use the same ledger
  and historical reporting model.
- Changing the setting is effective-dated and does not alter earlier occurrences
  or transactions.
- Automatic posting needs idempotency so an occurrence can never be posted more
  than once.
- A user-level creation default is not required by this decision and may be
  considered separately later.

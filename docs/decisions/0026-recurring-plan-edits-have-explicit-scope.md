# ADR 0026: Recurring-Plan Edits Have Explicit Scope

- Status: Accepted
- Date: 2026-07-14

## Context

A user may need to correct one unusual occurrence, change a plan from its next
occurrence onward, or schedule a known change for a later date. An in-place edit
cannot distinguish those intentions and risks recalculating history.

## Decision

Editing a recurring plan offers three explicit scopes:

- **This occurrence only:** override one expected occurrence without changing the
  recurring plan.
- **This and future occurrences:** create a new effective plan version beginning
  with the selected occurrence.
- **From a chosen future date:** create a new effective plan version beginning at
  the selected future effective date.

Past occurrences and actual transactions remain unchanged. Corrections to an
already posted actual transaction use the ledger correction model rather than a
recurring-plan edit.

## Consequences

- One-off deviations do not fragment or shift the recurring schedule.
- Future changes preserve the plan version that produced every historical
  occurrence.
- The UI always asks for edit scope before applying a recurring change.
- Conflicting future versions must be resolved deterministically and shown on a
  plan timeline.

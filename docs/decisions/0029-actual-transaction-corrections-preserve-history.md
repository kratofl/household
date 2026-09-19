# ADR 0029: Actual-Transaction Corrections Preserve History

- Status: Accepted
- Date: 2026-07-14

## Context

Users need a familiar Edit action when an actual transaction has the wrong
amount, date, description, category, or other value. Mutating or deleting the
original record would make historical balances and audit explanations unreliable.

## Decision

The user edits an actual transaction through a normal Edit workflow. Internally,
the original record remains preserved and the change creates a traceable
correction or revision.

Balances and ordinary reports use the effective corrected state exactly once.
The user can inspect the correction history when needed.

## Consequences

- Corrections record when the change happened and what values changed.
- Historical as-of reporting can distinguish the original posting from a later
  correction.
- Correcting a transfer updates both account sides atomically.
- Correcting a transaction linked to an expected occurrence does not rewrite its
  recurring plan.
- The UI remains simple even if persistence uses revisions or compensating ledger
  entries to preserve accounting integrity.

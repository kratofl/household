# ADR 0016: Overspending Does Not Silently Consume Buffer

- Status: Accepted
- Date: 2026-07-14

## Context

A Budget period may exceed its ordinary spending availability even though the
user has accumulated protected buffer. Treating that buffer as automatically
spendable would defeat its purpose, while hiding the deficit would make the next
period's plan unrealistic.

## Decision

Overspending and protected buffer remain separate, visible values.

At period close, the user may cover all or part of a deficit from accumulated
buffer. Any uncovered deficit carries into the next Budget period and reduces its
ordinary spending availability. The safe default is to preserve the buffer and
carry the full uncovered deficit forward.

## Consequences

- Budget does not silently consume protected money.
- Partial coverage is supported and leaves both the remaining buffer and the
  remaining carried deficit visible.
- Deficit carryover affects planning availability; it does not fabricate a
  financial-account transaction.
- Covering a deficit is an explicit, historically traceable allocation action.
- A period can close while negative, but the negative value cannot disappear
  without a recorded source of coverage or carryover.

# ADR 0051: Transaction Amount and Budget Impact Are Separate

- Status: Accepted
- Date: 2026-07-16

## Context

Budget is not reconciling a list of real bank accounts. A transaction records
what occurred, while the Budget must avoid charging the same value twice when a
commitment was already handled through gradual reservation.

A late-created reservation plan may not have accumulated the full first amount,
and the user explicitly does not want a default catch-up deduction.

## Decision

A transaction's full amount and its effect on ordinary spending availability are
separate values.

For a gradually reserved commitment, the full due amount appears in Transactions,
but it does not reduce ordinary spending availability again. If the first
occurrence is only partly reserved because the plan was entered late, the default
still adds no extra Budget deduction. The shortfall remains an informational
warning.

If the user explicitly enables first-shortfall charging, only that missing amount
affects ordinary spending in the due period.

## Consequences

- Transaction history can show the full 120 EUR subscription while monthly
  reservations are the only default Budget deductions.
- A transaction can have zero ordinary-Budget impact without disappearing from
  expense history.
- The UI exposes transaction amount, reservation coverage, and Budget impact
  separately when they differ.
- No balancing account, artificial income, or negative reserve is created for a
  late first occurrence.
- Reports distinguish total actual expenses from expenses charged directly to
  ordinary spending availability.

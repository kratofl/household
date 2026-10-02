# ADR 0038: Refunds Post When Received

- Status: Accepted
- Date: 2026-07-14

## Context

A merchant may refund all or part of an expense in a later Budget period.
Rewriting the original transaction or period would misstate when money actually
returned to the account and would destabilize closed historical reports.

## Decision

A refund is a new actual ledger transaction dated when the money is received. It
links to the original expense but does not modify that expense or its historical
period.

The refund restores category spending and ordinary availability in the period in
which it is received. If expense and refund occur in the same Budget period, they
net within that period naturally.

## Consequences

- Account history matches real cash movement dates.
- Full and partial refunds remain traceable to their source expense.
- A partial refund can allocate returned amounts across the original category
  splits without exceeding the refund total.
- Closed periods never change because a later refund arrives.
- Refunds are not reported as ordinary income even though they increase an
  account balance.

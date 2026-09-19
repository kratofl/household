# ADR 0047: Goal Contributions Pause at Full Funding

- Status: Accepted
- Date: 2026-07-15

## Context

A recurring contribution can continue after its savings goal reaches the target.
Automatically reserving more money would reduce ordinary spending without a
current user intention.

## Decision

When a goal becomes fully funded, future expected contributions assigned to that
goal pause automatically. Budget notifies the user and offers explicit choices to
resume contributing, redirect the contribution to another goal, or route it to
unallocated buffer.

## Consequences

- Full funding never causes silent over-allocation.
- An already posted contribution that crosses the target remains actual; its
  excess stays in the goal until the user reallocates it.
- Redirecting or resuming creates a prospective plan change and preserves the
  original contribution history.
- If the target later increases before completion, paused contributions do not
  resume silently; the user confirms the new plan.

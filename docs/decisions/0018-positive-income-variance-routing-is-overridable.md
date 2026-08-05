# ADR 0018: Positive Income Variance Routing Is Overridable

- Status: Accepted
- Date: 2026-07-14

## Context

Actual income may exceed the amount expected by a recurring income plan. Users
need a predictable default for that extra money, but different income sources may
serve different purposes.

## Decision

The user configures a global default rule for positive income variance and may
override it on an individual income plan.

The safe system default routes positive variance to unallocated buffer instead
of increasing ordinary spending availability automatically. A plan-level rule
takes precedence over the global rule.

Negative variance is not routable: it immediately reduces actually funded
availability and remains visible as a shortfall.

## Consequences

- Stable salary and variable side income can route extra amounts differently.
- Configuration changes apply prospectively and do not change historical income
  or period results.
- The applied rule and routed amount are visible in the period record.
- The complete set of supported positive-variance destinations remains to be
  confirmed.

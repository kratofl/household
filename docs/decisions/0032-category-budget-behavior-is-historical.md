# ADR 0032: Category Budget Behavior Is Historical

- Status: Accepted
- Date: 2026-07-14

## Context

A category can determine whether a transaction counts toward ordinary spending
availability. Reapplying a later behavior change to old transactions could turn
closed historical periods from positive to negative or the reverse.

## Decision

Each transaction preserves the category budget behavior that applied when the
transaction was posted. Changing a category between included and excluded
applies prospectively from its effective date and does not recalculate earlier
transactions or periods.

## Consequences

- Historical spending and availability reports remain stable.
- Category snapshots include budget behavior as well as display metadata.
- A user can inspect when category behavior changed.
- Correcting an individual transaction remains possible through the explicit
  transaction-correction workflow.

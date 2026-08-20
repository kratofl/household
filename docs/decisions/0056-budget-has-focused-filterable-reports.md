# ADR 0056: Budget Has Focused Filterable Reports

- Status: Accepted
- Date: 2026-07-16

## Context

Users need historical insight without learning a general-purpose reporting tool.
The agreed domain already provides clear comparisons that can be implemented as
focused, understandable reports.

## Decision

The completed Budget slice includes fixed report views for:

- Budget-period comparison;
- expenses by category and merchant;
- planned versus actual amounts;
- income development;
- buffer development; and
- savings-goal and investment development.

Reports support relevant date-range, category, and merchant filters. They show
absolute base-currency values and meaningful percentages together. A custom
report builder is outside the current scope.

## Consequences

- Each report defines its calculation and denominator explicitly.
- Filters are reflected consistently in summary values, tables, and charts.
- Historical category and plan snapshots keep reports stable after later edits.
- Export can reproduce the filtered underlying data.
- Empty or incomplete data states explain what is missing instead of presenting
  false trends.

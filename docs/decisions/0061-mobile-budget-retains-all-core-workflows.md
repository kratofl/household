# ADR 0061: Mobile Budget Retains All Core Workflows

- Status: Accepted
- Date: 2026-07-16

## Context

Users commonly record or confirm expenses away from a desktop. A read-only or
heavily reduced mobile version would make the manual-first Budget workflow less
useful and leave data incomplete.

## Decision

All core Budget workflows are fully usable on mobile, including overview,
transaction entry and confirmation, planning, saving and investing, wishlist,
categories, and settings.

Reports may use a more compact mobile presentation, but retain their essential
values, filters, and access to underlying data.

## Consequences

- Responsive behavior is part of feature acceptance, not a later polish task.
- Dense tables transform into suitable mobile lists or detail views without
  hiding required actions.
- Touch targets, form controls, dialogs, navigation, and charts are tested on
  representative narrow viewports.
- Desktop and mobile use the same domain behavior and API contracts.

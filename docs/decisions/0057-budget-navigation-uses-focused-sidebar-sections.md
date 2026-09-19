# ADR 0057: Budget Navigation Uses Focused Sidebar Sections

- Status: Accepted
- Date: 2026-07-16

## Context

The completed Budget slice contains several substantial workflows. Combining
them into one page would make the overview difficult to scan and contradict the
application's established sidebar-navigation convention.

## Decision

Budget uses these sidebar subnavigation sections:

1. Overview
2. Transactions
3. Planning — income, fixed costs, subscriptions, and reservations
4. Saving & Investing
5. Wishlist
6. Categories
7. Reports
8. Settings

Budget subnavigation is integrated into the application sidebar on desktop and
available through the corresponding mobile navigation pattern.

## Consequences

- Overview remains read-focused rather than becoming a large form collection.
- Deep links and browser navigation preserve the selected Budget section.
- Related planning concepts share one section while maintaining distinct views or
  filters inside it.
- Active-module authorization applies consistently to every Budget route.
- Account and admin settings remain separate from Budget Settings.

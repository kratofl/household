# ADR 0067: Budget Is One Module With Four Pages

- Status: Accepted
- Date: 2026-09-16

## Context

ADR 0057 gave Budget eight sidebar sections built around the original ledger,
commitment, and reporting screens. The monthly plan model replaced that workflow
and shipped alongside it under `/budget/preview`, so the sidebar carried two
Budget navigations at once. Which sections appeared depended on the current
route, which made items seem to vanish when the user moved between them.

## Decision

Budget is one collapsible sidebar group with four pages, in this order:

1. Overview — a widget board
2. Expenses
3. Planning
4. Savings

The monthly plan model owns all four. The older sections and their screens are
gone from the web client; their tables and endpoints remain, unconverted and
unreachable from the UI.

Every module is its own collapsible sidebar group. There is no "Modules"
heading above them, and a module with a single page is a plain link rather than
a group. The set of items inside a group does not change with the route.

## Consequences

- The sidebar tree has a stable shape, so a page is always where the user left it.
- Budget's landing page is arrangeable per device rather than a fixed layout;
  see ADR 0068.
- The old Budget's transactions, categories, savings, investments, wishlist, and
  reports have no UI. Restoring them means either reviving those screens or
  converting the data into the monthly model.
- ADR 0055, 0056, 0059, 0061, 0062, and 0063 describe screens that no longer
  exist in the client. They remain accurate about the retained backend rules.

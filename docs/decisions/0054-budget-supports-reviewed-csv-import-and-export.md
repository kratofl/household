# ADR 0054: Budget Supports Reviewed CSV Import and Export

- Status: Accepted
- Date: 2026-07-16

## Context

Budget is intended to replace an existing spreadsheet. Manual re-entry would make
adoption expensive, while an opaque import could introduce duplicates or corrupt
historical results. Users also need a portable copy of their data.

## Decision

The completed Budget slice supports CSV import and export.

Import uses a staged workflow:

1. upload and parse;
2. preview rows;
3. map source columns and values;
4. validate amounts, dates, currency, and references;
5. warn about probable duplicates; and
6. commit only after explicit confirmation.

Export covers transactions and their splits, categories, recurring plans,
savings and investment states, and other required Budget records in documented
CSV files.

## Consequences

- Importing the same source twice can be detected and reviewed rather than
  silently duplicating activity.
- Rejected rows include actionable reasons and do not partially disappear.
- Import history records source metadata and results without storing unnecessary
  sensitive source-file content.
- Exported amounts, dates, identifiers, statuses, and relationships have a stable
  documented format.
- Spreadsheet formulas and presentation are not imported; Budget imports data.

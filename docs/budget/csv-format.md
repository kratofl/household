# Budget CSV format

Budget exports and review-imports CSV per ADR 0054. All files are UTF-8, comma
delimited, RFC 4180 quoted, and start with a header row. Dates use `yyyy-MM-dd`,
booleans use `true`/`false`, and amounts use invariant decimals with a dot and
two fraction digits (`120.00`). Identifiers are stable UUIDs so relationships
between exported files survive a round trip.

## Export

`GET /api/v1/budget/export/{type}` returns `budget-{type}.csv` for the
authenticated user's ledger. Supported types and their relationship columns:

| Type | Columns |
| --- | --- |
| `transactions` | `id, kind, status, occurredOn, description, amount, ordinaryImpact, category, merchant, merchantNormalized, brandKey, source, correctsEntryId, relatedEntryId` |
| `splits` | `id, ledgerEntryId, categoryId, categoryName, amount, ordinaryImpact` |
| `categories` | `id, name, color, icon, behavior, archived` |
| `income-plans` | `id, seriesId, name, amount, cadence, intervalUnit, intervalCount, weekdays, effectiveFrom, effectiveTo, automaticPosting, active` |
| `commitments` | `id, seriesId, categoryId, kind, name, amount, cadence, intervalUnit, intervalCount, weekdays, effectiveFrom, effectiveTo, budgetingMode, chargeFirstShortfall, automaticPosting, active` |
| `savings-purposes` | `id, name, targetAmount, planningMode, targetDate, contributionsPaused, completedAt` |
| `savings-contributions` | `id, kind, occurredOn, description, amount` |
| `savings-allocations` | `id, contributionId, purposeId, amount` |
| `investment-events` | `id, kind, occurredOn, description, amount, destination, targetPurposeId` |

Transaction `status` is the effective ledger state (`actual`, `corrected`,
`voided`); corrected and voided rows stay in the export so history remains
complete. The `category` column carries the single-split snapshot name; entries
with multiple splits leave it empty and are detailed in `splits.csv`.

## Import

Import is a staged review workflow over `/api/v1/budget/import/sessions`:

1. `POST /import/sessions` `{ fileName, content }` parses the CSV (comma or
   semicolon detected from the header, at most 2000 data rows) and returns the
   header, a raw preview, and a suggested column mapping with detected date
   format and decimal separator.
2. `PUT /import/sessions/{id}/mapping` maps columns (`dateColumn` and
   `amountColumn` are required) plus `dateFormat` (`yyyy-MM-dd`, `dd.MM.yyyy`,
   `MM/dd/yyyy`, `dd/MM/yyyy`), `decimalSeparator` (`.` or `,`), and
   `defaultKind`. It returns every normalized row with a stable validation-error
   code (`invalid_date`, `invalid_amount`, `unsupported_kind`,
   `missing_description`) and probable-duplicate warnings against existing
   effective ledger entries and other rows in the same file.
3. `POST /import/sessions/{id}/commit` `{ includeDuplicates }` writes valid rows
   as manual-equivalent ledger entries (`source = import`) in one atomic
   transaction. Invalid rows are skipped with their reasons retained; duplicate
   rows are skipped unless explicitly included. Retrying a commit is idempotent
   and returns the recorded result without creating new records.

Row kinds come from the mapped kind column (`income`/`Einnahme`,
`expense`/`Ausgabe`); without a kind column negative amounts become expenses and
positive amounts use `defaultKind`. Amounts are stored as exact cents. Unknown
category names are created for the importing user; existing names are matched
case-insensitively. Corrections, voids, and refunds are export-only and are not
recreated by import.

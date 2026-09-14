# Monthly Budget preview

The simplified workflow is available at `/budget/preview`, with Expenses,
Monthly plan, and Savings below it. The existing Budget remains available at
`/budget`. This is an implementation for UI review before replacing the old
screens or converting existing financial data.

The proposal and spreadsheet examples are in [simplification-proposal.md](simplification-proposal.md).

## What works

- One monthly income amount, fixed costs, monthly buffer, monthly saving,
  monthly subscriptions, and yearly subscriptions.
- Yearly bills reduce the allowance only in the period containing their due
  date. Missing dates clamp to the last day of the due month.
- Immediate plan previews and a twelve-period outlook. After setup, additions,
  edits, removals, saving-rate changes, and category reservations start next
  period. Pending changes can be replaced or cancelled. Setting a rate to zero
  pauses that allocation; setting it above zero resumes it next period.
- Categories can be created, renamed, archived, and restored. A category with
  a current or pending reserve must have that reserve removed before archival.
  Expense records retain their historical category names.
- Expenses default to the category reserve when one exists, otherwise to fun
  money. Savings and buffer are explicit alternative sources. A protected-source
  shortfall offers an explicit split with fun money.
- One Savings balance with an opening amount, automatic monthly contributions,
  savings-funded purchases, and historical balances. Contributions are budget
  allocations, not bank transfers.
- Expense corrections, voids, and partial or full refunds preserve the original
  records. Reverse linked refunds before correcting or voiding their expense.
- German and English, mobile layouts, keyboard submission and focus restoration,
  expense filtering, and historical date selection.

Income and scheduled bills are planning assumptions. They do not require
monthly confirmation and must not be mistaken for verified bank transactions.
The overview shows scheduled bills separately. Do not enter those bills again
as ordinary purchases.

## Calculation

Starting fun money is income minus fixed costs, due subscriptions, buffer,
saving, category reserves, and any deficit brought forward. Purchases debit
their explicit sources once. Savings-funded spending does not debit fun money.

At rollover, remaining fun money and category money first net against a
fun-budget deficit. Positive leftovers increase Savings; a remaining deficit
reduces the next period's allowance. Category reserves reset each period.
Buffer accumulates separately and is only spent explicitly.

If a carried deficit makes the plan unaffordable, the period shows a funding
shortfall. It does not create that period's protected allocations. Existing
savings and buffer remain available. No partial automatic allocation priority
is assumed. The user can still record expenses from available sources and
adjust the next plan.

Refunds restore the original sources in their recorded order, up to the amount
paid from each source. A refund to a category that no longer has a funded
reserve goes to Savings. Historical corrections replay subsequent periods and
are rejected if they would overdraw a protected balance later in history.

The calculator replays elapsed periods from the first plan. There is no timer
or background posting job to duplicate contributions, and opening the app after
several months requires no manual close-period action. Future periods remain
forecasts. The existing period start day and currency are retained at setup;
the preview stores a timezone for its date boundaries.

## Storage and HTTP

The additive migration `202609140001_MonthlyBudgetPreview` creates
`budget.monthly_plans`, `budget.monthly_categories`, and `budget.monthly_entries`.
It does not convert, delete, or recalculate existing Budget records.

Plan versions and financial actions are append-oriented. Validated value
records are stored in JSONB. Expense sequence numbers preserve action order on
the same date. Writes use a per-owner PostgreSQL transaction advisory lock;
expenses also have unique per-owner request keys. Reusing a key with another
payload returns a conflict. Plan writes require the latest revision.

All routes below are relative to `/api/v1/budget/monthly` and require the
existing bearer session. Errors use problem JSON with a stable error code in
`detail`, translated by the client.

| Method and path | Purpose |
| --- | --- |
| `GET /?date=YYYY-MM-DD` | Current or historical state, categories, history, pending plan, outlook |
| `POST /plan/preview` | Validate and calculate an unsaved plan's next twelve periods |
| `PUT /plan` | First setup or a new next-period version |
| `DELETE /plan/pending?revision=N` | Append a version retaining the current plan next period |
| `POST /categories` | Create a category immediately |
| `PATCH /categories/{id}` | Rename, archive, or restore |
| `POST /expenses` | Record an expense, or append a correction using `correctsId` |
| `POST /expenses/{id}/refunds` | Record a dated partial or full refund |
| `POST /expenses/{id}/void` | Reverse an entry while keeping its history |

Requests and responses are defined by `MonthlyBudgetModels.cs` and
`MonthlyBudgetEndpoints.cs`. Browser access uses the Budget API wrapper, shared
API client, and existing Next proxy. All money is represented as integer cents.

## Review boundary

Existing transactions, categories, savings, investments, and custom recurring
plans have not been imported into the preview. The old reports and CSV endpoints
continue to describe the old Budget; they do not include preview entries.
Additional savings pots, merchant suggestions, and reconciliation of scheduled
bills with actual payments are not part of this preview. Do not use both
versions as one combined financial history.

The rollover defaults are visible in the Monthly plan screen. Confirm those
defaults and the UI before the cutover. Data mapping and updates to the old
product ADRs belong to that cutover; the existing historical records must remain
readable with their original rules.

## Verification

`MonthlyBudgetTests` covers the spreadsheet's allowances, fuel remaining,
savings funding, refunds, custom periods, clamped yearly due dates, rollover,
deficit netting, protected balances, and effective-dated plan changes.
`MonthlyBudgetHttpTests` exercises real PostgreSQL through authenticated HTTP,
including competing withdrawals, duplicate retries, source restoration,
corrections, plan conflicts and cancellation, and owner isolation.

The repository check passed on 2026-09-14 with 113 backend tests, backend and web
builds, web lint, and all Compose configurations. An isolated browser walkthrough
also exercised setup, ordinary/category/savings purchases, explicit shortfall
coverage, English and German, mobile layout, plan save/cancel, corrections,
refunds, and keyboard operation. Test artifacts belong under ignored `tmp/`.

# Monthly Budget

This is the Budget. The module has four pages: Overview at `/budget`, plus
Expenses, Planning, and Savings below it. The Overview is a widget board the
user arranges; the global dashboard draws from the same widgets.

The older Budget screens were removed from the web client. Their tables and
endpoints are untouched, and that data has never been converted into this
model, so it is no longer reachable through the UI.

## Why it works this way

The model replaces a spreadsheet kept by hand, and its main goal is removing
recurring manual work. The everyday routine is opening Budget and recording a
purchase. Creating months, copying recurring rows, confirming salary or each
subscription, transferring the planned saving, and closing periods are not
monthly chores, and the everyday flow does not ask for recurring confirmation,
income-variance routing, custom recurrence rules, wishlist management, or
investing setup.

- Fun money is calculated from the configured income, not from a confirmed
  salary transaction. It is an allowance, not a bank balance or proof that
  income arrived.
- Each plan deduction reserves money once. Recording the matching payment
  consumes that reserve and never charges fun money a second time.
- A missing payment record is not evidence of an unpaid bill or of spare money.
  Scheduled costs stay accounted for automatically and never become savings at
  rollover.
- Category and funding source are separate: the category says what an expense
  was for, the source which balance paid. A savings-funded car repair still
  counts toward car spending.
- There is no "excluded from budget" switch; every expense is fully assigned to
  real balances. A shortfall is never taken silently from fun money, buffer, or
  savings. An accepted fun-money remainder may make fun money negative and shows
  the deficit; protected balances never go negative.
- Category reserves are monthly allowances and reset each period, so a fuel
  allowance cannot quietly grow. Money meant to accumulate belongs in Savings.
- Rollover nets leftovers against a deficit first, so the same money is not both
  saved and treated as missing.
- An unaffordable plan never manufactures funded savings or protected reserves.
- Each expense stores its funding instead of recalculating it from today's
  category configuration.

## What works

- One monthly income amount, fixed costs, monthly buffer, monthly saving,
  monthly subscriptions, and yearly subscriptions.
- Yearly bills reduce the allowance only in the period containing their due
  date. Missing dates clamp to the last day of the due month without moving
  later years' dates.
- Immediate plan previews and a twelve-period outlook. Plan changes start next
  period by default, or overwrite the running period when the user picks "this
  period" before saving. Either way, periods that have already closed keep the
  plan version that produced them. Pending next-period changes can be replaced
  or cancelled. Setting a rate to zero pauses that allocation; setting it above
  zero resumes it. A plan that exceeds income in any of the next twelve periods
  cannot be saved.
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
the plan stores a timezone for its date boundaries.

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
| `PUT /plan` | First setup, a new next-period version, or with `applyToCurrentPeriod` a version that replaces the running period |
| `DELETE /plan/pending?revision=N` | Append a version retaining the current plan next period |
| `POST /categories` | Create a category immediately |
| `PATCH /categories/{id}` | Rename, archive, or restore |
| `POST /expenses` | Record an expense, or append a correction using `correctsId` |
| `POST /expenses/{id}/refunds` | Record a dated partial or full refund |
| `POST /expenses/{id}/void` | Reverse an entry while keeping its history |

Requests and responses are defined by `MonthlyBudgetModels.cs` and
`MonthlyBudgetEndpoints.cs`. Browser access uses the Budget API wrapper, shared
API client, and existing Next proxy. All money is represented as integer cents.

## Boundary

Transactions, categories, savings, investments, and custom recurring plans from
the older Budget were never imported. The old reports and CSV endpoints still
describe the old tables and contain none of these entries. The two are separate
financial histories and must not be added together.

Rewriting the running period is refused when a recorded expense would lose the
source it was paid from; the request replays the whole history first and returns
a conflict instead. Closed periods are never rewritten.

## Not implemented

These are open. When they are built, they keep the rules above and these:

- **Additional savings pots.** A pot needs only a name, a monthly contribution,
  and an optional opening amount; targets, deadlines, valuations, and allocation
  percentages stay out. An expense added from a pot defaults to that pot,
  whatever its category. Archiving a pot with money left requires an explicit
  destination for the balance.
- **Merchant suggestions.** Picking a known merchant may suggest a category from
  merchant history; the choice stays editable.
- **Reconciling scheduled bills with payments.** An optional Record payment
  action links an actual payment, or an already recorded expense (reversing its
  earlier funding), to the reserved plan item. It never creates a second charge,
  and a difference from the planned amount needs an explicit funding choice. A
  bill explicitly marked unpaid keeps its reserve across the period boundary, and
  its late payment does not charge the new period. Actual-only reporting must
  then tell scheduled amounts from recorded payments.
- **Converting the older Budget's data.** Old periods keep their old calculation
  rules. Existing plans and balances map into a next-period plan; excluded
  expenses, investments, and custom schedules are never silently reinterpreted.
  Unmappable items are presented for review and keep their history and balances.
  Imports, exports, reports, and old routes are audited first so they use or
  preserve the right funding rules.

## Verification

The reference plan below (`SpreadsheetPlan` in the tests) uses invented figures
and is not seed data:

| Calculation | Amount |
| --- | ---: |
| Salary | EUR 2,800.00 |
| Fixed payment, rent | -EUR 500.00 |
| Fuel reservation | -EUR 180.00 |
| Monthly savings | -EUR 1,000.00 |
| Buffer | -EUR 200.00 |
| Monthly subscriptions | -EUR 42.97 |
| Normal-period fun budget | **EUR 877.03** |
| September, after EUR 36.00 yearly credit-card fee | **EUR 841.03** |
| October, after EUR 69.00 yearly Amazon subscription | **EUR 808.03** |

With EUR 97.40 spent on fuel, EUR 82.60 of the fuel reserve remains and fun
money is unchanged.

`MonthlyBudgetTests` covers the spreadsheet's allowances, fuel remaining,
savings funding, refunds, custom periods, clamped yearly due dates, rollover,
deficit netting, protected balances, and effective-dated plan changes.
`MonthlyBudgetHttpTests` exercises real PostgreSQL through authenticated HTTP,
including competing withdrawals, duplicate retries, source restoration,
corrections, plan conflicts and cancellation, and owner isolation.

`Plan_can_overwrite_the_running_period_unless_it_unfunds_recorded_expenses`
covers the current-period option and its refusal case.

Test artifacts belong under ignored `tmp/`.

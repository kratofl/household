# Budget simplification proposal

Status: design proposal, based on Luca's four requirements on 2026-09-13.
The implemented model is described in [monthly-budget.md](monthly-budget.md).
It does not replace the existing Budget or supersede accepted ADRs yet.
Defaults below are recommendations where the request leaves behavior open.

Reference updated 2026-09-14: Luca's spreadsheet screenshots show the existing
workflow and establish reducing recurring manual work as a primary design goal.

## Everyday use

Set up a monthly plan once. Each period starts with that plan. Record expenses
as they happen and see how much fun money, category money, and savings remain.

The primary number is **Fun budget remaining**. It is based on the configured
income, not on confirming a salary transaction each month. This is a budget
allowance, not a bank balance or proof that income has arrived.

The normal routine is opening Budget and recording a purchase. Creating months,
copying recurring rows, confirming salary, confirming every subscription,
transferring the configured savings contribution, and closing periods must not
be monthly chores. Automatically advance elapsed periods exactly once, even if
the app has not been opened for several months. Future periods remain forecasts.

## What the spreadsheet establishes

The reference has three useful views: a standing plan with a yearly outlook,
category-grouped purchases for a month, and a savings history with contributions,
expenses, and a running balance. Keep those jobs while removing manual upkeep.

The plan screenshot provides a concrete acceptance example:

| Calculation | Amount |
| --- | ---: |
| Salary | EUR 2,551.73 |
| Fixed payment, Papa | -EUR 500.00 |
| Fuel reservation | -EUR 180.00 |
| Monthly savings | -EUR 1,000.00 |
| Buffer | -EUR 200.00 |
| Monthly subscriptions | -EUR 65.96 |
| Normal-period fun budget | **EUR 605.77** |
| September, after EUR 36 yearly credit-card fee | **EUR 569.77** |
| October, after EUR 89.90 yearly Amazon subscription | **EUR 515.87** |

These are reference values, not seed data or instructions to modify Luca's
current finances. The separate monthly screenshot uses another fun-budget
amount; do not assume all screenshots describe the same plan version or period.

The fuel example is EUR 180.00 reserved, EUR 121.62 spent, EUR 58.38 remaining.
The expense sheet also shows a previous-month deficit and negative purchase
rows. Support explicit refund entry and visible deficit carryover without
requiring signed-number arithmetic from the user. The screenshots do not settle
where positive leftovers or unused buffer should go.

Show a compact twelve-period outlook under Monthly plan, calculated from the
effective plan and yearly due dates. Savings shows a running balance and history;
future contribution projections must be distinguishable from savings accumulated
so far. Neither view requires manually creating monthly columns.

## Monthly plan

One form contains:

| Input | Fields |
| --- | --- |
| Monthly income | One amount |
| Fixed costs / Fixkosten | Name and monthly amount per item |
| Buffer / Puffer | One fixed monthly amount |
| Monthly subscriptions | Name and monthly amount per item |
| Yearly subscriptions | Name, yearly amount, next payment date |
| Monthly savings | Amount per savings pot |
| Reserved categories | Amount per category, such as Fuel |

Show the resulting fun budget immediately in a preview. Save the whole plan
atomically. An overallocated plan can be kept as an unsaved draft, but cannot be
activated with promised reserves that exceed income.

First setup applies to the starting period. After setup, monetary changes,
removals, pauses, and resumptions apply at the next period boundary. Show the
exact date beside Save, and show Current period and Next period side by side.
Further edits replace the pending next-period version. Cancel pending changes
restores the current plan as the next-period plan. Past periods retain their
plan values. Keep the user's existing period start day and currency.

A new ordinary category can be used immediately. Giving it a monthly reserve
starts next period. Turning a reserved category back into an ordinary category
also starts next period. Renaming or archiving retains historical labels and
funding references; archiving must not erase money or existing expenses.

## Calculation and example

Confirmed yearly-subscription rule: deduct the full bill only in the budget
period containing its due date. Show upcoming bills and their effect on future
fun budgets. Use exact cents throughout.

| Monthly plan | Amount |
| --- | ---: |
| Income | EUR 3,000 |
| Fixed costs | -EUR 1,200 |
| Buffer | -EUR 100 |
| Monthly subscriptions | -EUR 50 |
| Yearly subscription due this period | -EUR 600 |
| Savings contribution | -EUR 300 |
| Fuel reserve | -EUR 200 |
| Starting fun budget | **EUR 550** |

In a period with no yearly bill, the same plan starts with EUR 1,150 fun money.

Each deduction reserves money once. Recording the corresponding payment consumes
that reserve. It does not make a second deduction from the fun budget.

| Recorded expense | Result |
| --- | --- |
| EUR 60 fuel | Fuel remaining EUR 140; fun budget EUR 550 |
| EUR 40 restaurant | Fun budget EUR 510; fuel remaining EUR 140 |
| EUR 250 purchase from savings with EUR 900 available | Savings EUR 650; fun budget EUR 510 |

Fixed costs and subscriptions are already included in the plan. The user does
not need to record them again to make the budget work. An optional Record payment
action links an actual payment to its reserved plan item. It must also be possible
to link an already recorded expense, reversing its previous funding effect.
Differences from the planned bill require an explicit funding choice.

A missing manual payment record is not evidence of an unpaid bill or spare
money. Keep planned recurring costs accounted for automatically, labelled as
scheduled where shown in history. Optional payment records replace or reconcile
that representation; they never create a second charge. Actual-only reporting
must distinguish these scheduled amounts from manually recorded payments.

The annual bill uses a reserve created only in its due period. Recording its
payment consumes that reserve without charging fun money again. A bill on a
date missing from the due month uses that month's last day without shifting
future annual dates. Period assignment respects the user's period start day.
A bill explicitly marked unpaid keeps its reserve across the boundary; a late
payment must not charge the new period again. No monthly confirmation is needed
for the normal scheduled case. An unaffordable due-period
plan shows its shortfall in the preview and needs an explicit funding decision.

## Categories and funding

A category describes what an expense was for. A funding source describes which
balance paid for it. Keep both, so a savings-funded car repair still appears in
car expense totals.

The expense form asks for amount, category, date, and an optional description.
Show the selected funding source and its remaining balance beside the amount.
Default the date to today in the user's timezone. Adding from a category or
savings pot preselects that context. Selecting a known merchant can suggest a
category using the existing merchant history, with the choice still editable.
Keep source selection compact and expose extra controls when changing the source
or resolving a shortfall. Support entering another purchase without reopening
the form. Group the expense list by category on demand rather than requiring a
separate input table for every category.

- Ordinary category: defaults to fun budget.
- Reserved category: defaults to that category's current-period reserve.
- Expense added from a savings pot: defaults to that pot, independently of category.
- Linked fixed cost or subscription: uses that item's reserve.

The user can explicitly choose another funding source. There is no generic
"excluded from budget" switch that makes spending disappear from all balances.
Every expense must be fully assigned to real budget balances.

If a EUR 60 fuel expense arrives with EUR 40 reserved, show the EUR 20 shortfall.
Offer an explicit EUR 40 fuel + EUR 20 fun-budget split before saving. Do not
silently take it from fun money, buffer, or savings. An expense must remain
recordable when it exceeds a plan: an explicitly accepted fun-budget remainder
may make fun money negative and shows the deficit. Protected balances stay
nonnegative.

## Savings

Start with one pot named Savings. Additional named pots are optional. A pot
needs only a name, a monthly contribution, and an optional opening amount.
Targets, deadlines, investment valuations, and allocation percentages are not
part of this workflow.

At the start of each period, the contribution reduces fun money and increases
the pot once. These are internal budget allocations, not bank transfers or
consumption expenses. Display Current savings balance and Monthly contribution.
Only activated periods contribute to the current balance; future contributions
belong in previews.

Save an expense from a pot through the same expense form. Ordinary category
defaults must never override this explicit source. If the pot cannot cover the
expense, require an explicit additional source. Savings cannot silently go
negative. Refunds return money to the original funding sources. Corrections and
voids reverse the original allocation before applying the replacement.

Pause or resume monthly saving through the next-period plan. Keep the existing
balance available for spending while paused. An archive action with money left
requires an explicit destination; it cannot discard the balance.

## Period-end defaults to confirm

- Savings and reserves for unpaid yearly bills carry forward.
- Category reserves reset to their configured amount each period. They do not
  accumulate into an unexpectedly large fuel allowance.
- Unspent fun money and monthly category reserves move to general Savings at
  period close. This is a proposed default, not confirmed by the screenshots.
  Scheduled fixed costs and subscriptions are never treated as spare money merely
  because the user did not manually record their payments.
- Buffer accumulates separately and remains protected until the user explicitly
  uses it. No automatic overspend coverage.
- A fun-budget deficit reduces next period's fun budget. Period close must net
  releasable monthly leftovers against that deficit first, so the same money is
  not both saved and treated as missing. Savings and unpaid yearly-bill reserves
  remain protected.
- If income or carried debt makes the next plan unaffordable, display a funding
  shortfall and request a revised allocation. Never manufacture funded savings
  or protected reserves from an unfunded plan.

The category-reset choice treats categories as monthly allowances. Savings pots
provide the separate workflow for money that should accumulate.

## Navigation

| Page | Main job |
| --- | --- |
| Overview | Fun money remaining, reserved-category balances, savings total, Add expense |
| Expenses | Actual expense history, category/source filters, edit, void, refund |
| Monthly plan | All recurring inputs, categories, current/next-period comparison |
| Savings | Pot balances, contributions, history, Spend from savings |

Place currency and period settings under Monthly plan. Put detailed spending
breakdowns under Expenses. Do not require recurring confirmation, income-variance
routing, custom recurrence rules, wishlist management, or investing setup in
the new everyday flow.

Before changing real screens, build a scratch variant using the existing design
tokens and shadcn controls. Compare layout options there if needed. Preserve
German and English, mobile forms, keyboard navigation, and loading, empty,
validation, conflict, success, and error states.

## Implementation in this repository

The current BudgetPanel in `clients/web/src/components/app/app-shell.tsx` owns
many unrelated forms and request states. Move the new workflows into
`clients/web/src/features/budget/`; keep AppShell responsible for navigation.
Keep requests behind the existing Budget API wrapper, shared API client, and
Next proxy. Return calculated display values from the backend; views render
state and raise user intent.

Keep the existing Budget feature, authenticated user ownership, integer cents,
period calendar, and append-oriented financial history. Add a versioned monthly
plan and period allocation records. Category behavior currently distinguishes
included/excluded spending; a reserved amount and a spendable category balance
need explicit new persistence and projection behavior.

Use one backend calculation for plan preview and period activation. Store the
funding of each expense explicitly, rather than recalculating it from today's
category configuration. Apply source debits and ledger changes in the same
database transaction. Serialize competing balance changes and enforce unique
period activation keys so retries cannot contribute savings twice or overspend
a protected pot concurrently.

Existing savings purposes, contributions, purchases, and funding records are
candidate building blocks. Inspect their correction/refund behavior before
reuse; presence of an existing endpoint is not proof of compatibility.

At cutover, preserve old periods with their old calculation rules. Prepare a
mapping from existing plans and balances into the proposed next-period plan.
Do not silently reinterpret excluded expenses, investments, or arbitrary custom
schedules. Present unmappable items for review and retain their history and
balances. Update affected product documentation and ADRs when the design is
accepted. No production migration is authorized by this proposal.

## Acceptance checks for implementation

1. Reproduce every number in the example through authenticated HTTP requests.
   Include the spreadsheet's EUR 605.77 normal allowance, EUR 569.77 September
   allowance, EUR 515.87 October allowance, and EUR 58.38 fuel remainder.
2. Verify next-period add/edit/remove, reservation enable/disable, savings
   pause/resume, and cancellation of pending changes. Historical values stay stable.
3. Activate a period twice and concurrently. Savings and reservations happen once.
   Reopen after several missed periods and verify automatic chronological rollover.
4. Record savings, reserved-category, ordinary, and linked-bill expenses. Check
   each balance and expense reports for double deductions.
5. Exercise corrections, voids, partial/full refunds, category changes, archived
   categories, and refunds received after the original period has closed.
6. Verify yearly bills affect only their due periods, clamped due dates and custom
   period boundaries, late payments, missed periods, positive leftovers, deficit
   netting, insufficient savings, and concurrent withdrawals.
7. Verify source selection from Overview, Expenses, and Savings, plus German,
   English, mobile and keyboard paths. Audit imports, exports, existing reports,
   and old routes before cutover so they use or preserve the correct funding rules.
   Complete a normal period without confirming salary or recurring bills, manually
   posting planned savings, or pressing a period-close button. Unconfirmed recurring
   payments must not become artificial savings at rollover.
8. Run the repository check target before landing the implementation.

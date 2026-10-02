# Budget Glossary

This glossary records the shared language established while defining the
finished Budget slice. Terms will be refined as product decisions are made.

## Budget slice

The end-to-end Budget capability within Household. It includes the domain model,
database schema, backend API, and web interface needed for complete Budget user
journeys.

## Household

The broader product containing Budget and other feature slices such as shopping,
recipes, meal planning, calendar, and waste schedule.

## Shared dependency

A capability outside the Budget feature boundary that Budget needs in order to
work, such as authenticated identity, authorization, application navigation, or
dashboard integration. A necessary shared-dependency change is part of finishing
Budget without making unrelated features part of the Budget slice.

## Budget owner

The authenticated user whose private Budget data is being accessed. In the
current slice, periods, categories, ledger entries, and plans have exactly one
Budget owner. Ownership is not shared between users.

## Base currency

The single currency used for all of one user's Budget plans, transactions,
allocations, and reports in the current slice. Multi-currency tracking and
exchange-rate conversion are deferred.

## Budget sharing

A future capability through which multiple Household users may access the same
Budget data. Invitations, memberships, shared permissions, and multi-user
editing are outside the current Budget completion scope.

## Bank-account tracking

Modeling the user's real bank accounts, their individual balances, and transfers
between them. This is outside the current Budget slice, which uses one Budget
ledger per user.

## Live bank connection

An automated integration that retrieves account or transaction data from an
external financial institution. Live bank connections are outside the current
Budget completion scope.

## Staged CSV import

A data-import workflow that previews, maps, validates, and checks probable
duplicates before the user explicitly commits any Budget records.

## Recurring plan

A dated rule for expected income, a committed expense, or a saving or investment
contribution. It describes future intent and produces occurrences according to a
recurrence interval. Changing the plan does not rewrite prior occurrences.

## Custom recurrence

An advanced schedule expressed as every positive whole-number count of a time
unit, such as every two weeks. Standard daily, weekly, monthly, quarterly, and
yearly presets do not expose the interval count.

Custom weekly recurrence may also select several weekdays. Each selected day in
an active week produces its own occurrence.

## Clamped due date

The actual last-day-of-month date used for one recurring occurrence when its
plan's selected due day does not exist in that month. The stored schedule does
not drift and returns to the selected day later.

## Occurrence

One dated realization of a recurring plan. It preserves the name, amount, kind,
and other values that applied when it was produced so historical reports remain
stable.

## Expected occurrence

A dated income, expense, saving, or investment event produced by a plan but not
yet confirmed as an actual financial transaction. It informs forecasts without
changing the Budget ledger.

## Actual transaction

A confirmed financial event that changes the Budget ledger and contributes to
actual historical reporting. It may be entered manually, matched to an expected
occurrence, or posted automatically when the user has enabled that behavior.

Its full amount and its effect on ordinary spending availability may differ, for
example when a gradually reserved commitment is paid.

## Transaction timeline

The chronological view that combines expected occurrences and actual
transactions while exposing their distinct statuses and filter options.

## Confirmation reminder

An optional in-app prompt for an expected occurrence that is due or overdue and
still requires user confirmation. It resolves with the occurrence and is not
created for automatically posted items.

## Budget impact

The amount by which a transaction or reservation changes ordinary spending
availability. It is separate from transaction amount so previously reserved
expenses are not charged twice.

## Ledger

The authoritative dated record of one user's actual Budget activity. Actual
income, expenses, refunds, corrections, and voids derive historical totals from
this ledger.

## Opening balance

The starting value from the date on which the user begins Budget tracking. It is
not a collection of individual bank-account balances.

## Opening allocation

A dated savings, goal, buffer, or investment value that existed before Budget
tracking began. It establishes starting progress without being reported as new
income.

## Ledger adjustment

A dated ledger entry that explains an explicit correction to a derived Budget
total. It is used instead of silently overwriting history.

## Transaction correction

A traceable revision of an actual transaction's effective values. The original
record remains available for history while balances and ordinary reports use the
corrected state once.

## Voided transaction

An actual transaction whose financial and ordinary reporting effect has been
removed through a traceable Void action. Its original values, reason, and void
time remain in history.

## Refund

An actual incoming transaction linked to an earlier expense. It is posted when
received, restores applicable category spending and availability in that period,
and is not classified as income.

## Automatic posting

An optional behavior that turns an eligible expected occurrence into an actual
transaction without manual confirmation. The default behavior requires user
confirmation.

## Effective date

The date from which a new recurring plan or a change to an existing plan applies.
Earlier occurrences retain their previous values.

## Occurrence override

A change applied to one expected occurrence without changing its recurring plan
or later occurrences.

## Plan version

The immutable values of a recurring plan for a specific effective-date range.
Future edits create a new version so each occurrence remains attributable to the
values that produced it.

## Plan pause

A dated interval during which a recurring plan produces no occurrences. Skipped
occurrences are not automatically caught up when the plan resumes.

## Stopped plan

A recurring plan ended through an explicit Stop, End, or context-appropriate
cancel action. It produces no future occurrences and remains inspectable in
history rather than being deleted.

## Fixed cost

A committed recurring expense such as rent or an insurance payment. Saving and
investing are separate concepts rather than kinds of fixed cost.

Fixed costs and subscriptions are different kinds of the same recurring
commitment model.

## Archived category

A category no longer available for new transactions. Its identity and historical
name and color remain available to explain earlier transactions and reports.

## Category snapshot

The category name, color, icon, budget behavior, and other historically relevant
values retained for a transaction as they applied when it was posted.

## Budget-impact override

A visible per-transaction or per-split choice that differs from the selected
category's default Budget behavior. It is historical and does not require a
synthetic category.

## Merchant

The normalized retailer, service provider, employer, or other counterparty linked
to a transaction. It is independent of the transaction's category.

## Merchant logo

Visual metadata used to recognize a known merchant or brand quickly. It has a
generic fallback and never determines accounting or Budget behavior.

## Merchant suggestion

A selectable merchant match shown while the user enters a manual transaction.
Suggestions come from known brands and the user's prior merchant history; they do
not replace explicit user selection.

## Category suggestion

A visible, overridable category recommendation based on the user's confirmed
history for the selected merchant. A suggestion is not an automatic posting
rule.

## Category split

One categorized monetary portion of a transaction. Several splits may belong to
one Budget ledger transaction, but their amounts must sum exactly to its total.
Expense splits use concrete monetary amounts rather than percentages.

## Subscription

A recurring expense for continued access to a product or service. It has a start
date and continues according to its recurrence until paused or stopped.

Subscriptions share scheduling and historical behavior with fixed costs while
remaining separately labeled and reported.

## Savings or investment contribution

Money intentionally allocated to saving or investing on a schedule. It is
tracked separately from fixed costs, increases a savings or investment purpose
balance, and can contribute toward longer-term goals.

## Investment valuation snapshot

A manually entered, dated current investment value. It supports performance and
history reporting without being treated as income or a new contribution.

## Investment performance

The gain or loss shown in base-currency amount and percentage by comparing
current value with contributed capital while accounting separately for
withdrawals.

## Investment withdrawal

A dated actual removal of value from investing. Unlike an unrealized valuation
change, it can be explicitly reassigned to buffer, savings goals, or ordinary
spending availability.

## Allocation

Money intentionally removed from ordinary spending availability for a savings or
investment purpose. It changes the value's Budget purpose rather than recording
consumption.

## Planned purchase

A higher-value future expense that is planned outside ordinary monthly spending.
It may originate as a wishlist item and become linked to a funded savings goal.

## Budget wishlist item

A lightweight reminder for a financially significant future purchase. It does
not reserve money by itself but may later be promoted or linked to a savings
goal. It is distinct from the broader Household shopping-list slice.

## Savings goal

A funding target with an amount, optional target date, contribution plan,
progress, and eventual use. It may be linked to a Budget wishlist item.

## Date-driven goal

A savings goal with a target amount and target date from which Budget calculates
the required recurring contribution.

## Rate-driven goal

A savings goal with a target amount and chosen recurring contribution from which
Budget forecasts the funding date.

## Behind-plan goal

A goal whose actual allocation trails its expected progress. Budget shows the
required new rate or projected new date without creating automatic debt or
silently modifying its plan.

## Fully funded goal

A savings goal whose allocated balance has reached its current target. It remains
active for purchase planning and is not yet completed.

Reaching this state pauses future goal contributions until the user explicitly
resumes or redirects them.

## Completed goal

A goal closed after its actual purchase or an explicit user action. Its funding
and purchase history remains inspectable.

## Goal-funded purchase

An actual expense paid from value already allocated to a savings goal. It reduces
the goal balance and remains visible as consumption without charging ordinary
spending availability a second time.

## Purchase funding split

The explicit sources used for one actual purchase, such as a savings goal plus
ordinary spending or buffer. Funding portions do not duplicate the actual
expense and must cover it exactly.

## Goal allocation

Saved money assigned exclusively to one savings goal. A unit of money cannot
count toward several goals at once.

## Unallocated savings

Saved money not assigned to a specific goal, such as a general emergency buffer.
It is visible separately from goal-backed amounts.

## Contribution split

The division of one actual savings contribution across several exclusive goal
allocations using fixed amounts or percentages. Any unassigned remainder stays
unallocated.

## Available-income buffer

A user-configured portion of period income withheld from ordinary spending
availability. It remains visible in the Budget and is distinct from money already
allocated to a specific savings goal. It uses either a fixed-amount mode or a
percentage-of-income mode.

## Buffer-target shortfall

The visible difference between configured and actually funded buffer in a period.
It creates neither a Budget deficit nor an automatic future catch-up.

## Buffer disposition

The explicit period-close decision for accumulated buffer: retain it as an
unallocated reserve, assign it to saving or investing, or release it into the
next period's spending limit.

## Budget deficit

The amount by which actual ordinary spending exceeds a period's available
spending budget. It remains distinct from protected buffer and carries forward
unless the user explicitly covers it.

## Deficit carryover

The uncovered portion of a Budget deficit that reduces the next period's
ordinary spending availability without creating a ledger transaction.

## Due-period budgeting

A treatment for a non-monthly commitment in which its full amount reduces
available spending in the period when it is due.

## Gradual reservation

A treatment for a non-monthly commitment in which portions are reserved across
earlier Budget periods. The eventual payment consumes that reserve without
reducing available spending a second time.

## First-occurrence reservation shortfall

The portion of a gradually reserved commitment's first occurrence not covered
because the plan was entered late. Budget warns about it and does not perform an
automatic catch-up deduction by default.

## Budgeting mode

The per-item choice between due-period budgeting and gradual reservation for an
applicable recurring commitment. Changes are effective-dated and do not rewrite
past periods.

## Budget period

The user's monthly planning and reporting interval. It begins on a fixed day of
the month selected by the user and ends the day before the following boundary.
It defaults to a calendar month but is not dynamically tied to income arrival.
If its selected start day is missing from a short month, that boundary uses the
month's final calendar day without changing the stored preference.

## Budget overview

The current-period landing view that summarizes ordinary spending availability,
income variance, upcoming commitments, buffer, savings goals, and investments,
with links to their detailed workflows.

## Budget report

A focused historical comparison with defined calculations and relevant filters.
Reports show absolute values and percentages together and are not a general
custom-report builder.

## Ordinary spending availability

The calculated amount funded for discretionary consumption in a Budget period
after commitments, reservations, saving or investing, buffer, and deficit
carryover. It cannot exceed its sources of funds.

## Personal spending cap

An optional user-selected amount below maximum ordinary spending availability.
The difference remains reserved rather than becoming unexplained missing money.

## Income variance

The difference between expected and actual posted income for a plan or Budget
period. A positive variance goes to unallocated buffer by default; a negative
variance reduces actually funded spending availability.

## Income-variance routing

The rule that assigns positive income variance to a purpose. It has a global
user default and may be overridden by an individual income plan. Supported
destinations are buffer, current ordinary spending, savings goals, and investment
allocations.

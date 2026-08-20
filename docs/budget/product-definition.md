# Budget Product Definition

This is the evolving definition of what the Budget slice must support before it
is considered complete. Accepted architectural decisions live in
`docs/decisions/`; this document collects the user-facing capability model.

## Confirmed boundaries

- Budget is an end-to-end slice spanning persistence, backend behavior, API, and
  frontend workflows.
- Household's backend target is one .NET 10/ASP.NET Core modular-monolith
  process. The existing Go API is migrated rather than retained beside a
  separate C# Budget service.
- Existing Identity, authentication, module activation, platform behavior, and
  user data must retain functional parity through the backend migration.
- Budget data is private to one authenticated user for now.
- Financial data is managed manually; live bank connections are deferred.
- Past periods and recorded occurrences must remain historically stable when a
  recurring plan changes.
- Each user has one Budget base currency for all Budget data and reporting;
  multi-currency tracking and exchange-rate conversion are deferred.
- The base currency can be changed only before any monetary Budget data exists;
  a later change requires a future migration workflow.

## Confirmed capabilities

### First-use Budget setup

- A functional first-use flow captures base currency, period start day, initial
  income plans, buffer configuration, and optional opening savings or investment
  allocations.
- It uses the same validation and domain behavior as later settings changes.
- The broader polished registration and account-onboarding experience is a later
  enhancement.

### Budget overview

- The Budget landing page prioritizes the current period.
- It shows ordinary spending availability with category visualization, expected
  versus actual income, upcoming commitments and reservations, protected buffer,
  and savings or investment progress.
- Detailed entry, editing, planning, history, and reporting use focused
  subpages rather than crowding the overview.
- Sidebar subnavigation contains Overview, Transactions, Planning, Saving &
  Investing, Wishlist, Categories, Reports, and Settings.

### Budget periods

- Each user chooses a fixed monthly Budget-period start day.
- The default period starts on the first day of the month.
- The boundary is independent of actual income arrival dates.
- A start day missing from a short month uses that month's last calendar day and
  returns to the selected day in later months.
- Changing the configured start day applies prospectively and does not reshape
  historical periods.
- Maximum ordinary spending availability is calculated from income after
  commitments, reservations, saving or investing, buffer, and deficit carryover.
- The user can set a lower personal cap; setting a higher cap requires explicitly
  releasing real reserves.

### Income

- A user can maintain multiple income plans.
- Income can recur daily, weekly, monthly, quarterly, or yearly.
- A Custom schedule can express every N days, weeks, months, quarters, or years;
  interval counts are hidden for standard recurrence presets.
- Standard weekly recurrence uses the start date's weekday; Custom recurrence can
  select several weekdays and generates one occurrence per matching day.
- Income plans include dates and can be applied to the relevant Budget periods.
- Expected income, actual posted income, and their variance remain separately
  visible.
- By default, income received above the expected amount goes to the unallocated
  buffer instead of automatically increasing ordinary spending availability.
- The user configures a global disposition for positive income variance and can
  override it for an individual income plan.
- Positive variance can go to unallocated buffer, current ordinary spending,
  savings goals, or investment allocations.
- It can be divided by fixed amounts or percentages; any remainder goes to the
  unallocated buffer.
- An income shortfall immediately reduces actually funded spending availability.

### Budget ledger and balances

- Each user has one Budget ledger rather than a list of real bank accounts.
- The ledger records actual income, expenses, refunds, corrections, and voids.
- Current and historical Budget totals are derived from that ledger.
- Purpose balances track ordinary spending availability, protected buffer,
  savings goals, and investing independently of where money physically resides.
- Manual transactions do not require a bank-account selection.
- Actual transactions have a normal Edit workflow, but their original values and
  later corrections remain traceable.
- Balances and standard reports use the effective corrected transaction state.
- Incorrect or duplicate actual transactions are voided with a reason, not hard
  deleted; their financial effect disappears while history remains inspectable.
- Refunds are new actual transactions on their receipt dates and link to the
  original expenses without rewriting earlier periods.
- Refunds restore category spending and ordinary availability in their receipt
  periods but are not classified as income.
- The Transactions view combines expected and actual entries chronologically with
  explicit expected, confirmed, automatically posted, skipped, and voided states.
- Filters can isolate actual history or upcoming expected items.
- Text search covers merchant and notes; composable filters cover period,
  category, status, transaction kind, recurrence origin, and Budget impact.
- Active filters remain visible and can be reset together.
- Plans requiring confirmation can enable due-date and overdue in-app reminders.
- Automatically posted occurrences do not create confirmation reminders;
  external notification channels are deferred.

### Committed expenses

- Fixed costs and subscriptions are distinct recurring expense kinds.
- They are kinds of one shared recurring-commitment model and use the same
  scheduling, versioning, pause, stop, reminder, posting, and reservation rules.
- They can recur weekly, monthly, quarterly, or yearly.
- Custom recurrence supports every N intervals while common schedules remain
  simple presets in the UI.
- A due day missing from a target month produces an occurrence on that month's
  final day without changing later scheduled due days.
- A subscription can begin now and continue until it is paused or stopped.
- Occurrences inside a pause are skipped permanently rather than caught up after
  resumption.
- A saved recurring plan is stopped through a direct user action, not deleted or
  ended by requiring manual date entry.
- Stopped plans leave active views and remain available in history.
- A recurring expense can be scheduled to start in a future month for planning.
- A yearly subscription due in October affects the available Budget in October.
- For a non-monthly commitment, the user can choose whether its full amount
  affects the due period or whether money is reserved gradually across earlier
  periods.
- That budgeting mode is configured separately for each recurring item.
- When gradual reservation is used, the actual payment consumes the accumulated
  reserve and must not be counted a second time against available spending.
- If gradual reservation starts too late to fund the first occurrence fully, the
  normal full-cycle rate begins prospectively and Budget shows a shortfall
  warning instead of automatically increasing the rate.
- Per item, the user may explicitly choose to charge that first shortfall to the
  due period; the default makes no additional ordinary-budget deduction.
- Transaction amount and ordinary-Budget impact are distinct: the full due amount
  remains visible even when prior reservations or the late-entry default make its
  direct Budget impact zero.

### Historical integrity and forecasting

- Editing a recurring definition does not rewrite prior months.
- An edit can target one expected occurrence, this-and-future occurrences, or a
  freely selected future effective date.
- Changes have an effective date and affect only applicable current or future
  occurrences.
- Future plans are visible before they take effect so the user can plan ahead.
- By default, a due recurring item produces an expected occurrence and becomes
  an actual transaction only after user confirmation or matching.
- Users can enable automatic posting so eligible expected occurrences become
  actual transactions without manual confirmation.
- Automatic posting is configured per recurring plan and is disabled by default.
- Forecast values and actual ledger totals remain distinct: an expected item can
  affect planning, while only an actual transaction changes the ledger.

### Categories

- Categories can be renamed and recolored prospectively.
- Categories can have a user-selectable icon for faster visual recognition.
- Transactions retain the category name and color that applied when they were
  posted, so historical reports do not change after category edits.
- Category budget behavior is also historical; changing included versus excluded
  affects only transactions from the change's effective date.
- Category behavior supplies a default Budget impact that can be visibly
  overridden per transaction or category split.
- No protected synthetic “not counted” category is required.
- A category with history is archived rather than deleted and is unavailable for
  new transactions while remaining visible in historical views.
- One ledger transaction can be split across several selected categories with
  monetary amounts that sum exactly to the transaction total.
- Expense splits are entered as concrete amounts; the final split is offered the
  remaining amount automatically.
- Category reports and included-versus-excluded behavior operate per split while
  the Budget ledger retains one transaction.

### Merchants and brands

- A transaction can identify a normalized merchant or brand independently of its
  category.
- Known merchants and subscription providers display their appropriate brand
  logos in transaction and overview surfaces.
- Manual transaction entry uses a dedicated merchant field with suggestions from
  known brands and the user's own merchant history.
- Selecting a merchant shows ranked category suggestions learned from the user's
  confirmed history; the choice remains visible and overridable.
- The user can create a new merchant when no suggestion fits.
- Unknown merchants use a generic fallback and remain fully usable.
- Merchant logos are visual metadata and never control financial behavior.

### Saving and investing

- Saving and investing are not modeled as fixed-cost categories.
- First setup accepts dated opening balances for savings goals, unallocated
  savings or buffer, and investments without treating them as income.
- A saving or investment contribution moves value from ordinary spending into a
  savings or investment purpose balance and is not a consumption expense.
- The allocation reduces ordinary spending availability while increasing the
  corresponding savings or investment stand.
- The user can plan recurring saving or investment amounts by interval.
- Investments show contributed capital and current value separately.
- Users can enter dated manual valuation snapshots; Budget shows gain or loss in
  amount and percentage and retains valuation history.
- Unrealized investment gains or losses never change ordinary spending
  availability.
- An actual investment withdrawal is explicitly routed to buffer, savings goals,
  or ordinary spending; its safe default is unallocated buffer.
- Each unit of saved money is allocated to at most one goal, or remains
  unallocated as a general buffer.
- The savings balance can fund several goals, but their allocations cannot
  overlap or exceed the saved money available for allocation.
- One actual savings contribution can be divided by fixed amounts or percentages
  between several goals; any remainder stays unallocated.
- The user can plan larger future expenses outside ordinary monthly spending.
- The UI compares planned and actual amounts and shows progress, including useful
  percentages.
- A goal can be date-driven, calculating the required contribution, or
  rate-driven, forecasting the funding date.
- A missed or smaller contribution marks a goal behind plan and shows a revised
  rate or date; recurring changes require user confirmation.

### High-value future purchases

- The user can keep a reminder list of higher-value things they may want to buy
  later.
- A wishlist item can remain an unfunded reminder or be linked or promoted to a
  savings goal.
- A funded goal adds a target amount, optional target date, contribution plan,
  progress, and eventual actual purchase.
- A goal-funded actual purchase consumes its reserved goal balance and does not
  reduce ordinary monthly spending availability a second time.
- Partial goal-funded purchases are supported and remain visible as actual
  historical expenses.
- A cheaper purchase leaves the remainder in its goal until explicitly
  reallocated.
- A more expensive purchase requires an explicit additional source such as
  ordinary spending, buffer, or another reserve; goals never become implicitly
  negative.
- Reaching 100 percent marks a goal fully funded but not completed.
- A goal completes only after its actual purchase or an explicit user close and
  then remains available in history.
- Recurring contributions pause when their goal becomes fully funded; the user
  may resume or redirect them explicitly.
- This financially focused wishlist does not replace the broader Household
  shopping-list slice.

### Available-income buffer

- A user can configure a buffer from the income available in each Budget period.
- The user chooses either a fixed amount per period or a percentage of period
  income.
- A percentage forecast uses expected income; its actual result uses posted
  income.
- Buffer is capped at the amount the period can actually fund after mandatory
  commitments; an unmet target is shown as a shortfall and creates no deficit.
- A buffer-target shortfall is not caught up automatically in later periods.
- The buffer is withheld from ordinary spending availability and remains visible
  rather than disappearing from the plan.
- Unused buffer accumulates instead of expiring at period end.
- The user can retain it as an unallocated reserve, allocate it to saving or
  investing, or add it explicitly to the next period's spending limit.
- Buffer remains reserved regardless of where the money resides outside Budget;
  physical bank-account location is not tracked.
- The user can choose a default period-close destination and override it for one
  period.
- The safe system default retains the buffer as an unallocated reserve.
- Overspending does not automatically consume protected buffer.
- At period close, the user may cover a deficit fully or partially from buffer;
  any uncovered amount reduces the next period's spending availability.
- Without an explicit choice, the full deficit carries forward and the buffer
  remains protected.

## Deferred enhancement: polished account onboarding

A polished, multi-step registration and cross-product account-onboarding
experience should be added later. It can incorporate the functional Budget setup
but is not required for the current Budget completion milestone.

## Data portability

- CSV import provides preview, column mapping, validation, duplicate warnings,
  and explicit confirmation before committing data.
- CSV export covers transactions and splits, categories, recurring plans,
  savings, investments, and the identifiers needed to preserve relationships.
- Import targets data rather than spreadsheet formulas or visual formatting.

## Reporting

- Focused reports cover period comparison, category and merchant spending,
  planned versus actual values, income, buffer, savings goals, and investments.
- Reports support relevant date-range, category, and merchant filters.
- Absolute amounts and percentages appear together; a general custom report
  builder is outside the current scope.

## Localization

- Every Budget workflow and state is available in German and English.
- Dates, numbers, percentages, and base-currency amounts use locale-aware
  formatting.
- Stored domain values and API contracts remain language-neutral.

## Responsive use

- All core Budget workflows are fully usable on mobile and desktop.
- Reports may be visually compact on mobile but retain essential values, filters,
  and underlying-data access.

## Definition of done

- The supported backend runtime is the .NET 10/ASP.NET Core modular monolith;
  the Go API is no longer required for production or development operation.
- Existing Identity, authentication, module activation, updater-facing platform
  behavior, and persisted user data retain verified parity after migration.
- Every confirmed Budget workflow works end-to-end across database, backend, API,
  and frontend.
- Migration, domain, API, and critical browser behavior have focused automated
  coverage.
- Required builds, lint, and tests pass.
- German and English, responsive mobile use, keyboard operation, and useful
  empty, loading, validation, and error states are verified.
- No Budget placeholders, fake data, incomplete screens, or known critical
  defects remain.
- API, CSV, user, and relevant operational documentation match implementation.

## Decision status

The initial product-definition interview is complete. ADR and implementation
consistency must be audited before converting this definition into an
implementation plan.

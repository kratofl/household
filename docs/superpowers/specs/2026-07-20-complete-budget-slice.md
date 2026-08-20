# Complete the Budget Slice End-to-End

## Problem Statement

Household's current Budget implementation is an early prototype. It can show a
basic current-month summary, manage simple categories and planned expenses, and
record a manual expense, but it cannot yet replace the user's spreadsheet or
provide a trustworthy historical and forward-looking financial overview.

The missing behavior is not limited to frontend polish. The current persistence
model depends on mutable bank-account balances, calendar months, and mutable
planned-expense rows. Those assumptions conflict with the agreed product: one
private Budget ledger per user, effective-dated recurring plans, stable history,
calculated spending availability, explicit purpose allocations, and no modeled
real-world bank accounts.

Household is also expected to grow into a domain-rich modular monolith. The
current Go backend is still small enough to replace before the completed Budget
domain multiplies the migration cost. Maintaining a separate C# Budget service
beside the Go Identity API would create an unnecessary distributed system.

Budget therefore needs one coordinated completion effort across backend runtime,
database migration, domain behavior, authenticated API, web workflows,
localization, responsive design, data portability, reporting, tests, and
documentation. Completion means the slice is genuinely usable without
placeholders and without historical financial data changing unexpectedly.

## Solution

Migrate the complete Household API to a single .NET 10/ASP.NET Core modular
monolith backed by PostgreSQL. Preserve feature-owned schemas and explicit
feature boundaries, migrate the existing Identity and platform behavior with
functional parity, and retire the Go API after data and behavior have been
verified.

Implement Budget as an end-to-end, per-user feature module in that monolith. Use
an immutable, append-oriented ledger for actual financial events; effective-dated
versions for recurring intent; generated expected occurrences for forecasting;
and explicit purpose allocations for ordinary spending, buffer, savings, and
investing. Derive current and historical projections from these records rather
than mutating balance fields or rewriting earlier periods.

Provide a complete responsive Next.js experience with focused sidebar sections
for Overview, Transactions, Planning, Saving & Investing, Wishlist, Categories,
Reports, and Settings. The interface must support every core workflow in German
and English, use locale-aware formatting, and expose understandable empty,
loading, validation, conflict, and error states.

The primary testing seam is the authenticated Budget HTTP API against real
PostgreSQL migrations. Focused domain tests cover the combinatorial recurrence,
rounding, allocation, and period-calculation rules. A small browser suite covers
the most important complete user journeys through the web client and the same
API.

## User Stories

1. As an existing Household user, I can continue to sign in after the backend is
   migrated so that the platform change does not interrupt access to my account.
2. As an existing Household user, I retain my profile, role, approval status,
   active modules, and sessions or receive a deliberate reauthentication flow so
   that no identity state is silently lost.
3. As an administrator, I can continue to approve users and manage available and
   active modules through behavior equivalent to the current public API.
4. As an operator, I can deploy one Household API process rather than separate Go
   and C# services so that operation remains simple on a local network.
5. As a Budget user opening the feature for the first time, I am guided through a
   functional setup instead of landing on an unusable empty dashboard.
6. As a first-time Budget user, I can choose my base currency before financial
   data exists so that all plans, transactions, and reports use one currency.
7. As a Budget user with financial data, I cannot casually change the base
   currency so that existing amounts are not reinterpreted without a migration.
8. As a first-time Budget user, I can select my monthly period start day, initial
   income plans, buffer rule, and optional opening savings or investment values.
9. As a Budget user, I can revisit all functional setup values in normal settings
   so that onboarding does not create a separate configuration model.
10. As a Budget user, I see a current-period overview that prioritizes how much I
    can still spend rather than presenting a list of simulated bank accounts.
11. As a Budget user, I see expected and actual income, upcoming commitments,
    accumulated reservations, protected buffer, savings progress, and investment
    progress together on the overview.
12. As a Budget user, I see a clear visual breakdown of included category
    spending and remaining ordinary availability for the current period.
13. As a Budget user, I can navigate to Overview, Transactions, Planning, Saving
    & Investing, Wishlist, Categories, Reports, and Settings through nested
    dashboard sidebar navigation.
14. As a Budget user, I can use a fixed day of the month as my Budget-period
    boundary, with day 1 as the default.
15. As a Budget user choosing a late start day, I get the last valid calendar day
    in a short month without permanently changing my preferred boundary day.
16. As a Budget user changing my period start day, I affect only future periods
    so that closed and historical periods keep their original boundaries.
17. As a Budget user, my maximum ordinary spending availability is calculated
    only from funded income after commitments, reservations, savings,
    investments, buffer, and prior uncovered deficit.
18. As a Budget user, I can set a personal spending cap below the calculated
    maximum so that I can intentionally be more conservative.
19. As a Budget user, I cannot set an unfunded cap above the calculated maximum
    without explicitly releasing a real reserve into ordinary spending.
20. As a Budget user, I can create multiple named income plans because I may have
    salary, side income, benefits, or other recurring income.
21. As a Budget user, I can schedule income daily, weekly, monthly, quarterly, or
    yearly with start and optional stop dates.
22. As a Budget user, I can choose a Custom recurrence every N days, weeks,
    months, quarters, or years when a standard preset is insufficient.
23. As a Budget user, I can select multiple weekdays for a Custom weekly income
    plan and get one expected occurrence on each matching day.
24. As a Budget user, I can edit one occurrence, this and future occurrences, or
    a freely selected future effective date without rewriting prior income.
25. As a Budget user, I can see expected income separately from actual posted
    income so that forecasts are not mistaken for money received.
26. As a Budget user, I can confirm an expected income occurrence with its actual
    amount and date so that the difference remains visible.
27. As a Budget user, I can enable automatic posting separately on each income
    plan, while manual confirmation remains the default.
28. As a Budget user, an income shortfall immediately reduces funded ordinary
    availability instead of leaving me with money I did not receive.
29. As a Budget user, positive income variance goes to unallocated buffer by
    default instead of silently increasing the amount available to spend.
30. As a Budget user, I can configure a default positive-variance route and
    override it for one income plan.
31. As a Budget user, I can divide positive variance by fixed amounts or
    percentages among buffer, current spending, savings goals, and investments,
    with any remainder safely retained as unallocated buffer.
32. As a Budget user, I can create recurring commitments as either fixed costs or
    subscriptions while receiving the same scheduling and history behavior.
33. As a Budget user, I can schedule commitments weekly, monthly, quarterly, or
    yearly and use every-N Custom intervals where needed.
34. As a Budget user, a monthly due day missing from a short month is clamped to
    that month's last day without drifting in later months.
35. As a Budget user, I can create a commitment that starts in a future period so
    that forecasts include it only when it becomes effective.
36. As a Budget user, I can edit one expected commitment occurrence, this and
    future occurrences, or a chosen future effective date.
37. As a Budget user, changing a recurring commitment does not change actual or
    expected history before its effective date.
38. As a Budget user, I can pause a recurring plan for a date range and the
    occurrences inside that range are skipped rather than caught up later.
39. As a Budget user, I can stop a saved recurring plan with a clear action so
    that it leaves active planning but remains visible in history.
40. As a Budget user, I can choose per non-monthly commitment whether its full
    cost affects the due period or is gradually reserved across earlier periods.
41. As a Budget user using gradual reservation, I see the periodic reservation
    reduce ordinary availability before the payment is due.
42. As a Budget user using gradual reservation, the eventual payment consumes
    the accumulated reserve and is not deducted from ordinary availability a
    second time.
43. As a Budget user entering a gradual-reservation plan too late, I see the
    first-occurrence shortfall while the normal full-cycle rate begins
    prospectively.
44. As a Budget user entering a gradual-reservation plan too late, no automatic
    catch-up deduction occurs unless I enable the per-item due-period shortfall
    charge.
45. As a Budget user, I can see a transaction's full amount even when its direct
    ordinary-Budget impact is zero because a reserve funded it or late-entry
    policy excluded an extra deduction.
46. As a Budget user, a due plan produces an expected occurrence and becomes an
    actual transaction only through confirmation, matching, or enabled automatic
    posting.
47. As a Budget user, I can enable or disable in-app due and overdue reminders
    per plan when occurrences require confirmation.
48. As a Budget user, automatically posted occurrences do not generate redundant
    confirmation reminders.
49. As a Budget user, I can record manual actual income, expenses, refunds,
    savings contributions, investment contributions, and withdrawals without
    selecting a real-world bank account.
50. As a Budget user, I can view expected and actual entries in one chronological
    transaction timeline with clear expected, confirmed, auto-posted, skipped,
    corrected, and voided states.
51. As a Budget user, I can search transactions by merchant or notes and combine
    filters for period, category, status, kind, recurring origin, and Budget
    impact.
52. As a Budget user, active transaction filters remain visible and I can reset
    them together.
53. As a Budget user, I can open an actual transaction and see its financial
    details, category splits, origin, Budget impact, and audit history.
54. As a Budget user, I can correct an actual transaction through a normal edit
    workflow while the original values and correction remain traceable.
55. As a Budget user, I can void an incorrect or duplicate actual transaction
    with a reason rather than deleting it from history.
56. As a Budget user, balances and reports use the effective corrected state and
    exclude the financial effect of voided transactions.
57. As a Budget user, I can record a refund on the date it is received and link
    it to the original expense without changing the earlier period.
58. As a Budget user, a refund restores ordinary availability and category spend
    in its receipt period but is not classified as income.
59. As a Budget user, I can split one transaction among multiple categories using
    exact monetary amounts that sum to the transaction total.
60. As a Budget user entering category splits, the final split can take the
    remaining amount automatically while I can still override it before saving.
61. As a Budget user, each transaction or split can visibly override whether it
    affects ordinary spending, independent of the category name.
62. As a Budget user, I can create, rename, recolor, re-icon, and archive my own
    categories.
63. As a Budget user, category name, color, icon, and default Budget behavior
    changes apply prospectively and do not restyle or recalculate past entries.
64. As a Budget user, an archived category remains visible in history but cannot
    be selected for new entries.
65. As a Budget user, I do not need a synthetic protected “not counted” category
    because Budget impact is an explicit historical property.
66. As a Budget user, I can enter a normalized merchant independently of the
    expense category.
67. As a Budget user, known merchants such as REWE, EDEKA, HBO, or Disney can
    display the appropriate brand logo while unknown merchants use a generic
    fallback.
68. As a Budget user, merchant entry suggests known brands and values from my own
    confirmed history without forcing a match.
69. As a Budget user, selecting a merchant shows overridable category suggestions
    learned from my confirmed history.
70. As a Budget user, merchant logos and suggestions never determine financial
    behavior without my confirmed category and Budget-impact choices.
71. As a Budget user, I can configure a per-period buffer as a fixed amount or a
    percentage of income.
72. As a Budget user, expected income drives the forecast percentage buffer while
    actual posted income drives the final funded buffer.
73. As a Budget user, the system reserves no more buffer than the period can fund
    after mandatory commitments and shows any target shortfall without creating
    debt.
74. As a Budget user, a buffer-target shortfall is not automatically caught up in
    later periods.
75. As a Budget user, unused buffer accumulates visibly instead of expiring or
    disappearing at period close.
76. As a Budget user, I can configure a default period-close disposition to keep
    buffer unallocated, allocate it to saving or investing, or release it into
    the next period's spending limit.
77. As a Budget user, I can override the buffer disposition for one period while
    the safe default retains it as an unallocated reserve.
78. As a Budget user, overspending does not silently consume protected buffer.
79. As a Budget user, I can explicitly cover all or part of a period deficit from
    buffer and any uncovered amount reduces the next period's availability.
80. As a Budget user taking no deficit action, the full uncovered deficit carries
    forward and protected buffer remains untouched.
81. As a Budget user, I can add dated opening savings, buffer, goal, and investment
    allocations without incorrectly treating pre-existing value as income.
82. As a Budget user, a savings or investment contribution transfers funded value
    from ordinary spending into a purpose balance and is not a consumption
    expense.
83. As a Budget user, I can divide one contribution by fixed amounts or
    percentages among several goals and leave any remainder unallocated.
84. As a Budget user, every saved unit belongs to at most one goal so that several
    goals cannot claim the same money.
85. As a Budget user, I can create a date-driven savings goal and see the required
    contribution rate.
86. As a Budget user, I can create a rate-driven savings goal and see the forecast
    funding date.
87. As a Budget user, a missed or smaller goal contribution marks the goal behind
    plan and shows a revised rate or date without silently creating debt or
    changing my recurring instruction.
88. As a Budget user, reaching 100 percent marks a goal fully funded but does not
    mark it completed until an actual purchase or explicit close occurs.
89. As a Budget user, recurring contributions pause when a goal becomes fully
    funded and require an explicit resume or redirection.
90. As a Budget user, a goal-funded purchase consumes the goal allocation and
    does not reduce ordinary monthly availability a second time.
91. As a Budget user, I can fund one purchase from multiple explicit sources, and
    the funding portions must cover the purchase exactly.
92. As a Budget user, a cheaper goal purchase leaves the remainder allocated until
    I move it, while a more expensive purchase requires an explicit additional
    source and never makes the goal implicitly negative.
93. As a Budget user, I can record partial goal-funded purchases and retain both
    the financial history and remaining goal progress.
94. As a Budget user, I can record dated investment contributions separately from
    manual valuation snapshots.
95. As a Budget user, I see contributed capital, current value, and gain or loss
    in both amount and percentage without unrealized performance funding my
    spending budget.
96. As a Budget user, I can explicitly route an actual investment withdrawal to
    buffer, a savings goal, or ordinary spending, with unallocated buffer as the
    safe default.
97. As a Budget user, I can maintain a financially focused wishlist of high-value
    purchases that is distinct from Household's future everyday shopping list.
98. As a Budget user, I can leave a wishlist item as a reminder or link or promote
    it to a savings goal without creating duplicate funding.
99. As a Budget user, I can review fixed reports for period comparison, category
    and merchant spending, planned versus actual values, income, buffer, savings
    goals, and investments.
100. As a Budget user, I can filter applicable reports by date range, category,
    and merchant and see both absolute amounts and meaningful percentages.
101. As a Budget user, I can export transactions, splits, categories, recurring
    plans, savings, investments, and relationship identifiers as documented CSV.
102. As a Budget user, I can stage a CSV import, map columns, preview normalized
    values, see validation errors and probable duplicates, and explicitly confirm
    before any data is committed.
103. As a Budget user, retrying occurrence generation, automatic posting, or an
    import commit does not create duplicate financial records.
104. As a German-speaking user, I can complete every Budget workflow in German;
    as an English-speaking user, I can complete the same workflows in English.
105. As a Budget user, dates, numbers, percentages, and currency amounts follow my
    locale while stored enums and API values remain language-neutral.
106. As a mobile user, I retain every core Budget workflow and essential report
    value rather than receiving a read-only or reduced version.
107. As a keyboard user, I can navigate, operate, and validate Budget forms,
    dialogs, filters, tables, and navigation without a pointer.
108. As a Budget user, every screen provides useful empty, loading, validation,
    conflict, success, and error states rather than placeholders or fake data.
109. As an existing Budget prototype user, my recoverable categories, plans, and
    transactions are migrated into the final model without silent data loss.
110. As an operator, I can run migrations, health checks, builds, tests,
    containers, and local development using the .NET backend as the single source
    of truth after cutover.

## Implementation Decisions

- The supported backend target is .NET 10 with ASP.NET Core, EF Core, and the
  PostgreSQL provider. It is one modular-monolith API process, not a Go API plus
  a C# Budget service.
- The existing Go backend is the migration baseline. Identity, authentication,
  refresh/logout, user administration, module activation, configuration,
  health, update-facing platform behavior, and web-client contracts required by
  the current product must reach verified parity before the Go runtime is
  retired.
- PostgreSQL remains the single application database. Identity, Budget, and
  future features retain feature-owned schemas. A feature may use another
  feature's explicit service contract but may not query or mutate its tables.
- Each backend feature owns its domain model, application operations, endpoint
  registration, persistence mapping, and migrations. Shared platform code is
  limited to cross-cutting concerns such as hosting, authentication middleware,
  problem responses, observability, clock abstraction, and migration
  orchestration.
- Public HTTP behavior uses language-neutral request and response contracts,
  stable string enums, RFC-style problem responses, authenticated ownership
  checks, optimistic conflict handling where appropriate, and idempotency for
  retryable commands.
- All existing persisted Identity data must be preserved. Existing Budget data
  must be transformed into the one-ledger model where meaning can be recovered;
  ambiguous legacy records must be reported explicitly instead of silently
  discarded or guessed.
- The web client continues to call one backend through its existing server-side
  proxy, avoiding browser CORS coupling to local-network deployment details.
- One authenticated user owns one private Budget ledger. Sharing, memberships,
  bank-account lists, account balances, and account-to-account transfers are not
  part of this version.
- Actual financial history is append-oriented. Corrections, voids, refunds,
  allocations, and releases are traceable records; mutable cached balances are
  not the financial source of truth.
- Forecast intent and actual ledger state are separate. Recurring plans generate
  expected occurrences. Only confirmed, matched, or automatically posted actual
  records affect the ledger.
- Recurring plans use effective-dated versions plus occurrence-specific
  overrides. Edits require an explicit scope and never mutate earlier
  occurrences or closed-period results.
- One recurrence engine implements standard presets, every-N Custom schedules,
  multiple Custom weekdays, short-month clamping, pause ranges, stop state, and
  deterministic occurrence identity for incomes, commitments, and contributions.
- Fixed costs and subscriptions are kinds of one recurring-commitment model.
  Automatic posting, reminders, budgeting mode, and late-shortfall behavior are
  configured per plan.
- Transaction amount and ordinary-Budget impact are separate exact monetary
  values. Prior reservation funding, excluded impact, savings funding, refunds,
  and corrections must not be represented by changing the visible transaction
  amount.
- Money uses exact decimal or currency-minor-unit arithmetic and never binary
  floating point. Percentage allocations define deterministic rounding and send
  any remainder to the documented safe destination.
- Period projections distinguish expected, funded, reserved, actual, released,
  and carried values. Calculated maximum ordinary availability cannot exceed
  funded sources.
- Buffer is a protected purpose balance. Overspend cannot consume it without an
  explicit coverage command, and an underfunded buffer target creates a visible
  shortfall rather than a deficit.
- Savings and investing are purpose allocations within the one ledger, not
  expenses or simulated accounts. Goal allocations are exclusive and cannot
  exceed available saved value.
- Investment valuations are dated observations separate from contributed
  capital. Unrealized gains and losses never enter spendable funds; only an
  actual withdrawal followed by explicit routing can do so.
- Categories, their default Budget behavior, and merchant presentation metadata
  are versioned or snapshotted as needed to preserve historical display and
  calculation. Logos and suggestions have no authority over financial behavior.
- CSV import is a staged workflow with a temporary review model and an atomic,
  idempotent commit. CSV export includes stable identifiers necessary to retain
  relationships between exported record types.
- The Budget web feature owns its routes and focused components rather than
  remaining embedded in the application shell. It uses the existing shared UI
  components and localization infrastructure.
- The overview is a current-period decision surface. Detailed creation, editing,
  history, settings, and reports stay in their focused sidebar destinations.
- Accessibility, responsive behavior, localization, loading/error handling, and
  documentation are acceptance requirements, not later polish.
- The migration is complete only after development, CI, containers, Compose,
  configuration, migrations, and operational documentation use the .NET backend
  and no supported workflow requires the Go API.

## Testing Decisions

- The primary seam is the authenticated Budget HTTP API exercised against a real
  PostgreSQL instance created from production migrations. Tests issue public
  commands and queries and assert returned projections, ledger state, ownership,
  history, conflicts, and persisted results.
- Migration tests begin from representative existing Go-era schemas and fixtures,
  apply the .NET/EF Core migration path, and verify Identity parity plus lossless
  transformation of recoverable Budget data.
- API parity tests cover the existing Identity, authentication, module, health,
  and platform behaviors required by the web client before the Go API can be
  removed.
- Focused domain tests cover recurrence generation, selected period boundaries,
  short-month clamping, effective-dated edits, pause and stop behavior,
  reservation schedules, late first-occurrence shortfalls, and idempotent
  automatic posting.
- Focused calculation tests cover funded availability, personal caps, income
  variance, buffer caps and shortfalls, deficit coverage and carryover, refunds,
  category splits, Budget-impact overrides, goal allocation exclusivity,
  contribution routing, purchase funding, and investment withdrawals.
- Exact-money and percentage tests cover zero, minimum units, large values,
  deterministic rounding, final-split remainder, and invariants that allocations
  neither create nor lose money.
- Historical-integrity tests prove that later plan, category, merchant, period,
  or settings changes do not alter prior occurrences, snapshots, reports, or
  ledger totals.
- Ownership tests attempt cross-user reads and writes for every public Budget
  resource type and require non-disclosing rejection.
- CSV tests cover mapping, locale-shaped inputs, validation, duplicate warnings,
  atomic failure, idempotent retry, relationship preservation, and export/import
  round trips.
- A controllable clock and deterministic identifiers are used at test seams so
  due dates, period close, reminders, and scheduled work do not depend on wall
  clock timing.
- Browser tests are intentionally fewer than API tests and cover the highest
  value journeys: first setup; current overview; manual split expense; recurring
  commitment with gradual reservation; income confirmation and variance;
  correction/void/refund history; savings goal and funded purchase; CSV review;
  and mobile navigation.
- Browser coverage runs representative German and English journeys and checks
  keyboard operation plus meaningful loading, empty, validation, and error
  states.
- Build gates require backend restore/build/test, migration verification,
  frontend lint/build/test, browser tests for critical journeys, container build,
  and Compose configuration validation.
- The completion audit rejects placeholder data, disabled core actions, empty
  destination pages, unsupported locale strings, critical accessibility issues,
  or known defects that violate a stated user story.

## Out of Scope

- Budget sharing, shared ownership, invitations, permissions, or concurrent
  multi-user editing.
- Modeling or synchronizing real bank accounts, bank balances, bank transfers,
  open-banking connections, or automatic statement feeds.
- Multiple currencies inside one user's Budget, exchange-rate conversion, and a
  post-data currency migration workflow.
- A polished cross-product registration and account-onboarding experience beyond
  the functional first-use Budget setup.
- Email, push, messenger, calendar, or other external notification delivery.
- The broader Household shopping-list feature for routine groceries and errands.
- A general custom report builder or user-authored report formulas.
- Live brokerage connections, market-price feeds, and automatic investment
  valuation.
- Microservices, event brokers, or a permanent mixed Go/C# backend architecture.
- Native mobile applications; the responsive web experience is in scope.
- Automatic merchant/category decisions that cannot be reviewed or overridden.

## Further Notes

- The repository's Budget product definition and glossary define the shared
  product vocabulary. ADRs 0001 through 0066 are the normative record for the
  decisions summarized here.
- The current-state gap analysis is the implementation baseline. Passing the
  current Go tests proves only that the starting point is stable, not that the
  target Budget behavior exists.
- ADR 0040 supersedes the earlier account-oriented target: Budget presents one
  ledger and purpose balances per user, regardless of where money physically
  resides.
- ADR 0066 adds the .NET target after the Budget product interview. Architecture,
  development, deployment, CI, and database documents that still describe Go
  remain accurate descriptions of the current implementation until the migration
  lands; they must be updated as part of cutover.
- The older dashboard-navigation design predates the final Saving & Investing,
  Wishlist, and Reports destinations. This specification and ADR 0057 govern the
  completed navigation.
- This specification describes the complete product slice. Implementation should
  be decomposed into dependency-aware tracer-bullet tickets rather than attempted
  as one unreviewable change, while every ticket preserves the end-to-end target
  and historical invariants.

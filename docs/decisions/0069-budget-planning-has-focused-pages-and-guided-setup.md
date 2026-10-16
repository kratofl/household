# ADR 0069: Budget planning has focused pages and guided setup

- Status: Accepted
- Date: 2026-10-10
- Supersedes: ADR 0067's four-page navigation and combined Planning page

The combined Planning page made first-time setup hard to discover and mixed
unrelated maintenance tasks. Budget keeps one stable sidebar group, with
Overview, Expenses, Income & reserves, Fixed costs, Monthly subscriptions,
Yearly subscriptions, Categories, Merchants, and Savings as separate pages.
The plan remains one effective-dated monthly plan; splitting its editor does
not create separate plans or change historical calculations.

Before a plan exists, Budget guides the user through income and reserves,
costs, categories, and a review with an explicit start action. At least one
active category is required by the setup flow so the user can record an expense
immediately afterwards. Optional costs and reserves may remain zero.

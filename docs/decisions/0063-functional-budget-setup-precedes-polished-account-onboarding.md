# ADR 0063: Functional Budget Setup Precedes Polished Account Onboarding

- Status: Accepted
- Date: 2026-07-17

## Context

Budget cannot calculate useful values before it knows the user's base currency,
period boundary, income assumptions, buffer preference, and any existing saving
or investment progress. A polished multi-step registration and account-onboarding
experience is desirable but was explicitly requested as a later enhancement.

## Decision

The completed Budget slice includes a functional first-use Budget setup for:

- base currency;
- Budget-period start day;
- initial income plans;
- available-income buffer mode and value; and
- optional opening savings, goal, and investment allocations.

The broader, highly polished multi-step registration and account-onboarding
experience remains a later enhancement and does not block Budget completion.

## Consequences

- A new user can reach a correct Budget overview without manually discovering
  every settings page.
- Setup uses the same commands and validation as later settings edits rather than
  a separate domain path.
- Base-currency locking is explained before the first monetary record is created.
- Users may skip optional opening allocations and add them later through the
  traceable opening-value workflow.
- Visual polish for a future cross-product onboarding wizard is not used to defer
  functional Budget setup.

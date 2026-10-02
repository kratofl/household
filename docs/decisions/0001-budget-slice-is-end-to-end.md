# ADR 0001: The Budget Slice Is End-to-End

- Status: Accepted
- Date: 2026-07-14

## Context

Household is a multi-feature product. Budget is one feature slice within that
larger product, rather than a separate application or a synonym for the whole
repository.

A backend-only interpretation would leave Budget unusable. Finishing the slice
can require coordinated changes to its domain model, database schema, backend
API, and web interface.

## Decision

Treat Budget as an end-to-end vertical product slice inside Household.

The completion boundary includes all backend and frontend behavior required for
the agreed Budget user journeys. Work outside Budget remains out of scope unless
it is a necessary shared dependency, such as identity, authorization, navigation,
or cross-slice dashboard integration.

## Consequences

- A backend endpoint alone does not complete a Budget capability; its required
  user-facing workflow must also be usable.
- Budget acceptance criteria must cover persistence, domain behavior, API
  contracts, frontend states, and appropriate automated or manual verification.
- Budget-specific code should remain feature-owned while using established
  Household platform and UI conventions.
- This ADR defines the boundary only. The exact capabilities required for
  Budget to be considered finished are being resolved separately.

# ADR 0064: Budget Completion Has an End-to-End Quality Bar

- Status: Accepted
- Date: 2026-07-17

## Context

Budget is an end-to-end product slice with interdependent historical, financial,
API, and frontend behavior. Calling it complete when only endpoints or visible
forms exist would leave critical workflows unreliable.

## Decision

Budget is complete only when:

- every agreed workflow functions end-to-end across persistence, backend, API,
  and frontend;
- migrations plus domain and API rules have focused automated tests;
- critical user journeys have frontend or browser-level automated coverage;
- required builds, linting, and test suites pass;
- German and English localization, responsive mobile behavior, keyboard use, and
  understandable empty, loading, validation, and error states are verified;
- no placeholder data, incomplete Budget screens, or known critical Budget
  defects remain; and
- API, CSV, user, and relevant operational documentation match the shipped
  implementation.

## Consequences

- Backend-only or UI-only completion does not satisfy the slice.
- Historical-integrity, allocation, recurrence, import, and calculation tests are
  release requirements, not optional follow-up work.
- Manual verification supplements rather than replaces stable automated coverage.
- A known limitation must be explicitly accepted as out of scope; it cannot be
  hidden behind “complete.”
- The current implementation is measured against this bar through a documented
  gap analysis before implementation planning.

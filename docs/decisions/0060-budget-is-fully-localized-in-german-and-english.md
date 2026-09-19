# ADR 0060: Budget Is Fully Localized in German and English

- Status: Accepted
- Date: 2026-07-16

## Context

The web application already supports German and English. Shipping only part of
Budget in both languages would create mixed-language workflows precisely where
financial meaning and validation need to be unambiguous.

## Decision

Every user-facing Budget workflow is fully available in German and English,
including navigation, forms, validation and problem messages, statuses, reminders,
CSV import and export guidance, reports, empty states, and confirmations.

Dates, numbers, percentages, and the configured base currency use locale-aware
formatting. Persisted domain values and API enums remain language-neutral.

## Consequences

- New Budget copy is added through the existing i18n system rather than embedded
  directly in feature components.
- Automated checks detect missing translation keys where practical.
- CSV machine fields and stable status codes do not change with UI language;
  human-readable templates may be localized explicitly.
- Merchant and user-provided names are never translated automatically.

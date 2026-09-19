# ADR 0052: Transaction Timeline Combines Expected and Actual Items

- Status: Accepted
- Date: 2026-07-16

## Context

Users need one chronological overview of what has happened and what is coming.
Separate planned and actual screens would make comparison harder, while an
unlabeled combined list would blur forecast and history.

## Decision

The Transactions view presents expected occurrences and actual transactions in
one chronological timeline with explicit statuses, including:

- expected;
- confirmed;
- automatically posted;
- skipped;
- voided.

Users can filter the timeline by status, including views for only actual history
or only upcoming expected items.

## Consequences

- Expected entries remain visually distinct and do not imply ledger impact.
- Automatically posted is an actual status with visible provenance, not a third
  financial state.
- An expected occurrence changing state retains one traceable identity rather
  than appearing as an unrelated duplicate.
- Amount, reservation coverage, and Budget impact remain visible where they
  differ.
- Timeline queries and pagination must preserve deterministic chronological
  ordering across expected and actual records.

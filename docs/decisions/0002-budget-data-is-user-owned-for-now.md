# ADR 0002: Budget Data Is User-Owned for Now

- Status: Accepted
- Date: 2026-07-14

## Context

Household may eventually support sharing a budget between users. The current
Budget slice needs a clear ownership boundary without taking on household
membership, invitations, shared permissions, or conflict handling prematurely.

The existing Budget persistence model assigns periods, categories, accounts,
transactions, and planned expenses to an `owner_user_id`.

## Decision

Budget data is private to one authenticated user in the current slice.

Each user owns and accesses only their own Budget configuration and records.
Budget sharing is a future capability and is not required for the current slice
to be complete.

## Consequences

- Keep explicit user ownership and enforce it on every Budget read and write.
- Do not add household membership, shared-budget permissions, invitations, or
  multi-user editing to the current completion scope.
- Avoid assumptions that would unnecessarily prevent ownership from being
  generalized in a future migration.
- An account in Budget means a financial account tracked by its owning user; it
  does not currently imply access by several Household users.

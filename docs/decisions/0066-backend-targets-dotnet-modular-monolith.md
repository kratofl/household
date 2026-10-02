# ADR 0066: The Backend Targets a .NET Modular Monolith

- Status: Accepted
- Date: 2026-07-17

## Context

Household is intended to grow from Identity and Budget into several
business-domain features with relational data, historical rules, scheduled
work, and shared authentication. The current Go backend is still small, while
the completed Budget slice requires a substantial expansion of the domain and
API.

Running Budget as a separate C# service beside the existing Go Identity API
would contradict the chosen modular-monolith direction and introduce a second
deployment, cross-process contracts, duplicated infrastructure, and avoidable
operational complexity.

## Decision

The complete Household backend will be migrated to .NET 10 and ASP.NET Core as
one modular-monolith process before or as the foundation of the completed
Budget slice.

The migration must:

- preserve the feature-module boundaries and one-PostgreSQL-database model;
- retain feature-owned schemas and prohibit direct cross-feature table access;
- migrate Identity, authentication, module activation, platform behavior, and
  existing public API behavior required by the web client;
- implement Budget as a feature module in the same process rather than as a
  separate service;
- use EF Core with the PostgreSQL provider for persistence and migrations;
- preserve existing user data and migrate existing Budget data into the final
  ledger model where source data exists; and
- remove the Go API from the supported runtime after functional parity and data
  migration are verified.

The web client continues to access a single backend through its server-side
proxy. The migration may evolve endpoint contracts where the completed Budget
domain requires it, but language-neutral API behavior and ownership rules remain
stable.

## Consequences

- Household keeps one deployable API and does not become a mixed Go/C# service
  architecture.
- Backend scalability is not the reason for the switch; both platforms can meet
  expected load. The decision favors an integrated application platform for a
  growing relational business domain.
- Identity parity, data preservation, deployment, configuration, health checks,
  migrations, CI, and operational documentation are part of the migration.
- The current Go backend remains the behavioral baseline until the .NET backend
  passes the agreed parity and end-to-end tests.
- New Budget implementation work targets the .NET backend rather than expanding
  the Go implementation and rewriting it later.

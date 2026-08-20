# Database migrations

Each backend feature owns an EF Core context and keeps its migration history in its PostgreSQL schema.

| Feature | Context | History table |
| --- | --- | --- |
| Identity | `IdentityDbContext` | `identity.__EFMigrationsHistory` |
| Budget | `BudgetDbContext` | `budget.__EFMigrationsHistory` |
| Audit | `AuditDbContext` | `audit.__EFMigrationsHistory` |

Migrations run in dependency order on API startup. Initial adoption migrations use `IF NOT EXISTS` and additive changes so databases created by the retired Go runtime retain their data.

Create a migration from the repository root:

```bash
make create-migration feature=budget name=AddLedgerEntries
make create-migration feature=identity name=AddProfileFields
```

The Make target installs the matching .NET 10 `dotnet-ef` tool when needed and writes the migration into the owning feature. Review generated migrations for ownership, history preservation, safe deployment, and rollback implications before committing them.

Reset only disposable local data with:

```bash
make reset-dev-db
make dev
```

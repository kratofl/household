# Database Migrations

## 1. Overview

Our microservices use database migrations to manage schema changes in a versioned and controlled way.
We use **Goose** and **GORM** for migrations. Each migration can be written in **SQL** or **Go**.

* **Goal:** Keep schema changes traceable, allow rollbacks (when safe), and enable automated deployments.
* **Location of migrations:** `internal/db/migrations` in each service repository.

---

## 2. Creating a Migration

### SQL Migration

```bash
goose -dir internal/db/migrations create <migration_name> sql
```

### Go Migration

```bash
goose -dir internal/db/migrations create <migration_name> go
```

**Notes:**

* `<migration_name>` should be descriptive, e.g., `add_users_email`.
* Files are automatically timestamped: `20250819123045_add_users_email.sql`.

---

## 3. Migration Structure

### SQL Example

```sql
-- +goose Up
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- +goose Down
ALTER TABLE users DROP COLUMN email;
```

### Go Example

```go
package migrations

import (
    "database/sql"
    "github.com/pressly/goose/v3"
)

func init() {
    goose.AddMigration(upAddUsersEmail, downAddUsersEmail)
}

func upAddUsersEmail(tx *sql.Tx) error {
    _, err := tx.Exec("ALTER TABLE users ADD COLUMN email VARCHAR(255);")
    return err
}

func downAddUsersEmail(tx *sql.Tx) error {
    _, err := tx.Exec("ALTER TABLE users DROP COLUMN email;")
    return err
}
```

---

## 4. Testing Migrations Locally

```bash
# Apply migration
goose -dir internal/db/migrations postgres "postgres://user:pass@localhost:5432/dbname?sslmode=disable" up

# Rollback migration
goose -dir internal/db/migrations postgres "postgres://user:pass@localhost:5432/dbname?sslmode=disable" down
```

* Always test first on a local database.
* Ensure both **Up** and **Down** scripts work correctly.

---

## 5. CI/CD & Deployment

* Migrations run **automatically in staging** before deploying a new version.
* Production migrations can be triggered manually or integrated into the CD workflow.
* Migration versions are tracked via Git (commits + tags).

---

## 6. Best Practices

* **Forward-only migrations:** Avoid using Down scripts in production except for experimental branches.
* **Backward-compatible changes:** Add new columns/tables first, remove old ones later.
* **Atomic migrations:** Each migration should perform a single logical change.
* **Documentation:** Briefly describe purpose, risks, and dependencies for each migration.
* **Naming convention:** `YYYYMMDDHHMMSS_description.sql` ensures proper ordering.

---

## 7. References

* [Goose GitHub](https://github.com/pressly/goose)
* [GORM AutoMigrate](https://gorm.io/docs/migration.html)
* [Database Migration Best Practices](https://www.red-gate.com/simple-talk/sql/database-administration/database-migrations-best-practices/)

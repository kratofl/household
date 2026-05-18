package budget

import "testing"

func TestMigrationConfig(t *testing.T) {
	if MigrationSourceURL == "" {
		t.Fatal("MigrationSourceURL is empty")
	}
	if MigrationTableName != "budget_schema_migrations" {
		t.Fatalf("MigrationTableName = %q, want budget_schema_migrations", MigrationTableName)
	}
}

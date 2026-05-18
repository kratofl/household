package identity

import "testing"

func TestMigrationConfig(t *testing.T) {
	if MigrationSourceURL == "" {
		t.Fatal("MigrationSourceURL is empty")
	}
	if MigrationTableName != "identity_schema_migrations" {
		t.Fatalf("MigrationTableName = %q, want identity_schema_migrations", MigrationTableName)
	}
}

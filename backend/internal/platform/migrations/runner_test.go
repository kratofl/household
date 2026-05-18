package migrations

import "testing"

func TestRunPostgresValidatesFeatureMigration(t *testing.T) {
	tests := []struct {
		name     string
		features []FeatureMigration
	}{
		{
			name:     "missing name",
			features: []FeatureMigration{{SourceURL: "file://migrations", MigrationsTable: "schema_migrations"}},
		},
		{
			name:     "missing source",
			features: []FeatureMigration{{Name: "identity", MigrationsTable: "identity_schema_migrations"}},
		},
		{
			name:     "missing table",
			features: []FeatureMigration{{Name: "identity", SourceURL: "file://migrations"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := RunPostgres(nil, "household", tt.features); err == nil {
				t.Fatal("RunPostgres() returned nil error, want validation error")
			}
		})
	}
}

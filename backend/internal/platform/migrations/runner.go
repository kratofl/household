package migrations

import (
	"database/sql"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	migratePostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

type FeatureMigration struct {
	Name            string
	SourceURL       string
	MigrationsTable string
}

func RunPostgres(db *sql.DB, databaseName string, features []FeatureMigration) error {
	for _, feature := range features {
		if feature.Name == "" {
			return fmt.Errorf("feature migration name is required")
		}
		if feature.SourceURL == "" {
			return fmt.Errorf("migration source URL is required for %s", feature.Name)
		}
		if feature.MigrationsTable == "" {
			return fmt.Errorf("migration table is required for %s", feature.Name)
		}

		driver, err := migratePostgres.WithInstance(db, &migratePostgres.Config{
			MigrationsTable: feature.MigrationsTable,
		})
		if err != nil {
			return fmt.Errorf("create migration driver for %s: %w", feature.Name, err)
		}
		if err := run(feature.SourceURL, databaseName, driver); err != nil {
			return fmt.Errorf("migrate %s: %w", feature.Name, err)
		}
	}
	return nil
}

func run(sourceURL string, databaseName string, driver database.Driver) error {
	m, err := migrate.NewWithDatabaseInstance(sourceURL, databaseName, driver)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration up: %w", err)
	}
	return nil
}

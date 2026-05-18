package database

import (
	"testing"

	"household/backend/internal/platform/config"
)

func TestPostgresDSN(t *testing.T) {
	c := &config.Config{
		DB: config.ConfigDB{
			Host:     "household-db",
			Port:     5432,
			Username: "household",
			Password: "secret",
			DBName:   "household",
		},
	}

	got := PostgresDSN(c)
	want := "host=household-db user=household password=secret dbname=household port=5432 sslmode=disable"
	if got != want {
		t.Fatalf("PostgresDSN() = %q, want %q", got, want)
	}
}

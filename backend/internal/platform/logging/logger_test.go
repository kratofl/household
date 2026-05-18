package logging

import (
	"testing"

	"household/backend/internal/platform/config"

	"github.com/rs/zerolog"
)

func TestLogLevelUsesExplicitLevel(t *testing.T) {
	got, err := logLevel(&config.Config{Log: config.ConfigLog{Level: "debug"}})
	if err != nil {
		t.Fatalf("logLevel() returned error: %v", err)
	}
	if got != zerolog.DebugLevel {
		t.Fatalf("logLevel() = %v, want %v", got, zerolog.DebugLevel)
	}
}

func TestLogLevelRejectsInvalidLevel(t *testing.T) {
	if _, err := logLevel(&config.Config{Log: config.ConfigLog{Level: "verbose"}}); err == nil {
		t.Fatal("logLevel() returned nil error, want error")
	}
}

func TestCloseWithoutFile(t *testing.T) {
	logger := &AppLogger{}
	if err := logger.Close(); err != nil {
		t.Fatalf("Close() returned error: %v", err)
	}
}

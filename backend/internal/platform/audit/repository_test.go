package audit

import (
	"context"
	"testing"
)

func TestEventTableName(t *testing.T) {
	if got, want := (Event{}).TableName(), "audit.events"; got != want {
		t.Fatalf("TableName() = %q, want %q", got, want)
	}
}

func TestRepositoryRecordValidatesEvent(t *testing.T) {
	repo := NewRepository(nil)

	tests := []struct {
		name  string
		event *Event
	}{
		{name: "nil", event: nil},
		{name: "missing action", event: &Event{Module: "identity", Outcome: OutcomeSuccess}},
		{name: "missing module", event: &Event{Action: "auth.login", Outcome: OutcomeSuccess}},
		{name: "missing outcome", event: &Event{Action: "auth.login", Module: "identity"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := repo.Record(context.Background(), tt.event); err == nil {
				t.Fatal("Record() returned nil error, want validation error")
			}
		})
	}
}

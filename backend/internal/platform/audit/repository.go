package audit

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Record(ctx context.Context, event *Event) error {
	if event == nil {
		return fmt.Errorf("audit event is required")
	}
	if event.Action == "" {
		return fmt.Errorf("audit action is required")
	}
	if event.Module == "" {
		return fmt.Errorf("audit module is required")
	}
	if event.Outcome == "" {
		return fmt.Errorf("audit outcome is required")
	}

	if len(event.Metadata) == 0 {
		event.Metadata = []byte("{}")
	}

	if err := r.db.WithContext(ctx).Create(event).Error; err != nil {
		return fmt.Errorf("record audit event: %w", err)
	}
	return nil
}

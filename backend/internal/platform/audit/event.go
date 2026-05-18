package audit

import (
	"time"
)

const (
	OutcomeSuccess = "success"
	OutcomeFailure = "failure"
)

type Event struct {
	ID          string    `gorm:"type:uuid;default:uuidv7();primaryKey" json:"id"`
	OccurredAt  time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"occurredAt"`
	ActorUserID *string   `gorm:"type:uuid" json:"actorUserId,omitempty"`
	ActorRole   string    `gorm:"size:64;not null;default:''" json:"actorRole"`
	Action      string    `gorm:"size:128;not null" json:"action"`
	Module      string    `gorm:"size:64;not null" json:"module"`
	TargetType  string    `gorm:"size:128;not null;default:''" json:"targetType"`
	TargetID    string    `gorm:"size:128;not null;default:''" json:"targetId"`
	Outcome     string    `gorm:"size:32;not null" json:"outcome"`
	RequestID   string    `gorm:"size:128;not null;default:''" json:"requestId"`
	IP          string    `gorm:"size:128;not null;default:''" json:"ip"`
	UserAgent   string    `gorm:"size:512;not null;default:''" json:"userAgent"`
	Metadata    []byte    `gorm:"type:jsonb;not null;default:'{}'" json:"metadata,omitempty"`
	Before      []byte    `gorm:"type:jsonb" json:"before,omitempty"`
	After       []byte    `gorm:"type:jsonb" json:"after,omitempty"`
	ErrorCode   string    `gorm:"size:128;not null;default:''" json:"errorCode"`
}

func (Event) TableName() string {
	return "audit.events"
}

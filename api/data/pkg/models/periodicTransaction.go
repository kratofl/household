package models

import (
	"time"

	"github.com/kratofl/budget/data/pkg/types/transactions"
)

type PeriodicTransaction struct {
	Id            string
	Name          string
	Amount        int64
	StartDate     time.Time
	DueDate       time.Time
	Paused        bool
	PausedUntil   time.Time
	ExecuteManual bool

	TypeId     int
	PeriodId   int
	CategoryId string
	CompanyId  string
}

type PeriodicTransactionPeriod struct {
	Id          transactions.PeriodicTransactionPeriodId
	Name        string
	DisplayName string
}

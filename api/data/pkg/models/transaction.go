package models

import (
	"time"

	"github.com/kratofl/budget/data/pkg/types/transactions"
)

type Transaction struct {
	Id     string
	Amount int64
	Date   time.Time

	CategoryId string
	CompanyId  string
	TypeId     int
	BudgetId   string
}

type TransactionType struct {
	Id          transactions.TransactionTypeId
	Name        string
	DisplayName string
}

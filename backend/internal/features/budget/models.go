package budget

import (
	"time"

	"github.com/google/uuid"
)

const (
	CategoryBehaviorInclude = "include_in_limit"
	CategoryBehaviorExclude = "exclude_from_limit"
	PlannedKindFixedCost    = "fixed_cost"
	PlannedKindSubscription = "subscription"
	CadenceMonthly          = "monthly"
	CadenceYearly           = "yearly"
)

type Period struct {
	ID                      uuid.UUID `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID             uuid.UUID `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	Name                    string    `json:"name"`
	StartDate               time.Time `json:"startDate"`
	EndDate                 time.Time `json:"endDate"`
	SpendingLimitCents      int64     `json:"spendingLimitCents"`
	OverspendCarryoverCents int64     `json:"overspendCarryoverCents"`
	CreatedAt               time.Time `json:"createdAt"`
	UpdatedAt               time.Time `json:"updatedAt"`
}

func (Period) TableName() string {
	return "budget.periods"
}

type Category struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID uuid.UUID `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Behavior    string    `json:"behavior"`
	Protected   bool      `json:"protected"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (Category) TableName() string {
	return "budget.categories"
}

type Account struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID  uuid.UUID `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	Name         string    `json:"name"`
	BalanceCents int64     `json:"balanceCents"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (Account) TableName() string {
	return "budget.accounts"
}

type Transaction struct {
	ID               uuid.UUID  `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID      uuid.UUID  `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	PeriodID         uuid.UUID  `json:"periodId" gorm:"column:period_id;type:uuid;not null"`
	AccountID        uuid.UUID  `json:"accountId" gorm:"column:account_id;type:uuid;not null"`
	CategoryID       *uuid.UUID `json:"categoryId" gorm:"column:category_id;type:uuid"`
	PlannedExpenseID *uuid.UUID `json:"plannedExpenseId" gorm:"column:planned_expense_id;type:uuid"`
	OccurredOn       time.Time  `json:"occurredOn"`
	Description      string     `json:"description"`
	AmountCents      int64      `json:"amountCents"`
	IncludeInLimit   bool       `json:"includeInLimit"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

func (Transaction) TableName() string {
	return "budget.transactions"
}

type PlannedExpense struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID    uuid.UUID  `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	AccountID      uuid.UUID  `json:"accountId" gorm:"column:account_id;type:uuid;not null"`
	CategoryID     *uuid.UUID `json:"categoryId" gorm:"column:category_id;type:uuid"`
	Name           string     `json:"name"`
	Kind           string     `json:"kind"`
	Cadence        string     `json:"cadence"`
	AmountCents    int64      `json:"amountCents"`
	DueDay         int        `json:"dueDay"`
	DueMonth       *int       `json:"dueMonth"`
	IncludeInLimit bool       `json:"includeInLimit"`
	Active         bool       `json:"active"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

func (PlannedExpense) TableName() string {
	return "budget.planned_expenses"
}

type PlannedExpenseApplication struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;default:uuidv7();primaryKey"`
	OwnerUserID      uuid.UUID `json:"ownerUserId" gorm:"column:owner_user_id;type:uuid;not null"`
	PlannedExpenseID uuid.UUID `json:"plannedExpenseId" gorm:"column:planned_expense_id;type:uuid;not null"`
	PeriodID         uuid.UUID `json:"periodId" gorm:"column:period_id;type:uuid;not null"`
	TransactionID    uuid.UUID `json:"transactionId" gorm:"column:transaction_id;type:uuid;not null"`
	AppliedAt        time.Time `json:"appliedAt" gorm:"column:applied_at;default:CURRENT_TIMESTAMP"`
}

func (PlannedExpenseApplication) TableName() string {
	return "budget.planned_expense_applications"
}

package budget

import (
	"time"

	"github.com/google/uuid"
)

type CategorySummary struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Color      string    `json:"color"`
	Behavior   string    `json:"behavior"`
	SpentCents int64     `json:"spentCents"`
}

type Summary struct {
	Period              Period                  `json:"period"`
	Categories          []CategorySummary       `json:"categories"`
	SpentInLimitCents   int64                   `json:"spentInLimitCents"`
	ExcludedSpentCents  int64                   `json:"excludedSpentCents"`
	RemainingCents      int64                   `json:"remainingCents"`
	AccountBalanceCents int64                   `json:"accountBalanceCents"`
	Accounts            []Account               `json:"accounts"`
	PlannedExpenses     []PlannedExpenseSummary `json:"plannedExpenses"`
}

func BuildSummary(period Period, categories []Category, transactions []Transaction) Summary {
	categoriesByID := make(map[uuid.UUID]int, len(categories))
	categorySummaries := make([]CategorySummary, 0, len(categories))
	for _, category := range categories {
		categoriesByID[category.ID] = len(categorySummaries)
		categorySummaries = append(categorySummaries, CategorySummary{
			ID:       category.ID,
			Name:     category.Name,
			Color:    category.Color,
			Behavior: category.Behavior,
		})
	}

	var spentInLimit int64
	var excludedSpent int64
	for _, tx := range transactions {
		if tx.CategoryID != nil {
			if index, ok := categoriesByID[*tx.CategoryID]; ok {
				categorySummaries[index].SpentCents += tx.AmountCents
			}
		}
		if tx.IncludeInLimit {
			spentInLimit += tx.AmountCents
			continue
		}
		excludedSpent += tx.AmountCents
	}

	return Summary{
		Period:             period,
		Categories:         categorySummaries,
		SpentInLimitCents:  spentInLimit,
		ExcludedSpentCents: excludedSpent,
		RemainingCents:     period.SpendingLimitCents - period.OverspendCarryoverCents - spentInLimit,
	}
}

func currentMonthBounds(now time.Time) (time.Time, time.Time) {
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, -1)
	return start, end
}

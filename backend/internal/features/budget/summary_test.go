package budget

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestBuildSummaryCountsOnlyIncludedExpensesAgainstLimit(t *testing.T) {
	periodID := uuid.New()
	foodID := uuid.New()
	ignoredID := uuid.New()
	period := Period{
		ID:                 periodID,
		Name:               "Mai 2026",
		StartDate:          date(2026, time.May, 1),
		EndDate:            date(2026, time.May, 31),
		SpendingLimitCents: 240000,
	}
	categories := []Category{
		{ID: foodID, Name: "Lebensmittel", Color: "#ef4444", Behavior: CategoryBehaviorInclude},
		{ID: ignoredID, Name: "Nicht speichern", Color: "#64748b", Behavior: CategoryBehaviorExclude, Protected: true},
	}
	transactions := []Transaction{
		{PeriodID: periodID, CategoryID: &foodID, AmountCents: 4200, IncludeInLimit: true},
		{PeriodID: periodID, CategoryID: &foodID, AmountCents: 800, IncludeInLimit: true},
		{PeriodID: periodID, CategoryID: &ignoredID, AmountCents: 9900, IncludeInLimit: false},
	}

	summary := BuildSummary(period, categories, transactions)

	if summary.SpentInLimitCents != 5000 {
		t.Fatalf("spent in limit = %d, want 5000", summary.SpentInLimitCents)
	}
	if summary.ExcludedSpentCents != 9900 {
		t.Fatalf("excluded spent = %d, want 9900", summary.ExcludedSpentCents)
	}
	if summary.RemainingCents != 235000 {
		t.Fatalf("remaining = %d, want 235000", summary.RemainingCents)
	}
	if len(summary.Categories) != 2 {
		t.Fatalf("category count = %d, want 2", len(summary.Categories))
	}
	if summary.Categories[0].SpentCents != 5000 {
		t.Fatalf("food spent = %d, want 5000", summary.Categories[0].SpentCents)
	}
	if summary.Categories[1].SpentCents != 9900 {
		t.Fatalf("ignored spent = %d, want 9900", summary.Categories[1].SpentCents)
	}
}

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

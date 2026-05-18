package budget

import (
	"testing"
	"time"
)

func TestPlannedExpenseOccurrenceForMonthlyClampsToPeriodEnd(t *testing.T) {
	period := Period{
		StartDate: date(2026, time.February, 1),
		EndDate:   date(2026, time.February, 28),
	}
	planned := PlannedExpense{
		Cadence: CadenceMonthly,
		DueDay:  31,
		Active:  true,
	}

	occurredOn, ok := plannedOccurrenceDate(period, planned)

	if !ok {
		t.Fatal("monthly planned expense should apply")
	}
	if !occurredOn.Equal(date(2026, time.February, 28)) {
		t.Fatalf("occurredOn = %s, want 2026-02-28", occurredOn.Format("2006-01-02"))
	}
}

func TestPlannedExpenseOccurrenceForYearlyAppliesOnlyInDueMonth(t *testing.T) {
	period := Period{
		StartDate: date(2026, time.May, 1),
		EndDate:   date(2026, time.May, 31),
	}
	dueMonth := 6
	planned := PlannedExpense{
		Cadence:  CadenceYearly,
		DueDay:   15,
		DueMonth: &dueMonth,
		Active:   true,
	}

	if _, ok := plannedOccurrenceDate(period, planned); ok {
		t.Fatal("yearly planned expense should not apply outside the due month")
	}
}

func TestPlannedExpenseOccurrenceForYearlyUsesDueMonth(t *testing.T) {
	period := Period{
		StartDate: date(2026, time.June, 1),
		EndDate:   date(2026, time.June, 30),
	}
	dueMonth := 6
	planned := PlannedExpense{
		Cadence:  CadenceYearly,
		DueDay:   31,
		DueMonth: &dueMonth,
		Active:   true,
	}

	occurredOn, ok := plannedOccurrenceDate(period, planned)

	if !ok {
		t.Fatal("yearly planned expense should apply in the due month")
	}
	if !occurredOn.Equal(date(2026, time.June, 30)) {
		t.Fatalf("occurredOn = %s, want 2026-06-30", occurredOn.Format("2006-01-02"))
	}
}

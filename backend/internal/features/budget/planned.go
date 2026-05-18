package budget

import (
	"errors"
	"strings"
	"time"
)

type PlannedExpenseSummary struct {
	PlannedExpense
	AppliedInCurrentPeriod bool `json:"appliedInCurrentPeriod"`
}

func plannedOccurrenceDate(period Period, planned PlannedExpense) (time.Time, bool) {
	if !planned.Active {
		return time.Time{}, false
	}
	switch planned.Cadence {
	case CadenceMonthly:
		return clampDay(period.StartDate, period.EndDate, planned.DueDay), true
	case CadenceYearly:
		if planned.DueMonth == nil || int(period.StartDate.Month()) != *planned.DueMonth {
			return time.Time{}, false
		}
		return clampDay(period.StartDate, period.EndDate, planned.DueDay), true
	default:
		return time.Time{}, false
	}
}

func clampDay(start time.Time, end time.Time, dueDay int) time.Time {
	if dueDay < 1 {
		dueDay = 1
	}
	if dueDay > end.Day() {
		dueDay = end.Day()
	}
	return time.Date(start.Year(), start.Month(), dueDay, 0, 0, 0, 0, time.UTC)
}

func normalizePlannedKind(raw string) (string, error) {
	kind := strings.TrimSpace(raw)
	if kind == "" {
		return PlannedKindFixedCost, nil
	}
	switch kind {
	case PlannedKindFixedCost, PlannedKindSubscription:
		return kind, nil
	default:
		return "", errors.New("planned expense kind is invalid")
	}
}

func normalizeCadence(raw string) (string, error) {
	cadence := strings.TrimSpace(raw)
	if cadence == "" {
		return CadenceMonthly, nil
	}
	switch cadence {
	case CadenceMonthly, CadenceYearly:
		return cadence, nil
	default:
		return "", errors.New("planned expense cadence is invalid")
	}
}

package transactions

const (
	PeriodDaily   PeriodicTransactionPeriodId = 0
	PeriodWeekly  PeriodicTransactionPeriodId = 1
	PeriodMonthly PeriodicTransactionPeriodId = 2
	PeriodYearly  PeriodicTransactionPeriodId = 3
)

type PeriodicTransactionPeriodId int

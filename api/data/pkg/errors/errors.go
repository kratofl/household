package errors

type DataError struct {
	cause   error
	Message string
	Table   string
	Action  DataErrAction
}

func NewDataError(cause error, msg string, table string, action DataErrAction) *DataError {
	return &DataError{
		cause:   cause,
		Message: msg,
		Table:   table,
		Action:  action,
	}
}

func NewDataErrorInsert(cause error, table string) *DataError {
	return NewDataError(cause, "insert action failed", table, InsertDataErrAction)
}

func (e *DataError) Error() string {
	return e.cause.Error()
}

type DataErrAction string

const (
	InsertDataErrAction DataErrAction = "INSERT"
	UpdateDataErrAction DataErrAction = "UPDATE"
	AlterDataErrAction  DataErrAction = "ALTER"
	DeleteDataErrAction DataErrAction = "DELETE"
	DropDataErrAction   DataErrAction = "DROP"
	SelectDataErrAction DataErrAction = "SELECT"
)

package errors

import (
	"errors"
	"net/http"
)

var FieldMissingErr = errors.New("field missing")

func NewFieldMissingError(field string) *ValidationError {
	return NewValidationError(NewApiError(FieldMissingErr, "Please provide a value", ValidationAppErrType, FieldMissingErrCode, FieldMissingErrStrCode, http.StatusBadRequest), field)
}

var FieldInvalidErr = errors.New("field invalid")

func NewFieldInvalidError(field string) *ValidationError {
	return NewValidationError(NewApiError(FieldInvalidErr, "The provided value ist invalid", ValidationAppErrType, FieldInvalidErrCode, FieldInvalidErrStrCode, http.StatusBadRequest), field)
}

type ValidationError struct {
	Field    string
	ApiError *ApiError
}

func (err *ValidationError) Error() string {
	return err.ApiError.Error()
}

func NewValidationError(cause *ApiError, field string) *ValidationError {
	return &ValidationError{
		ApiError: cause,
		Field:    field,
	}
}

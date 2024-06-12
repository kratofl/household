package errors

import (
	"errors"
	"net/http"
)

func NewInvalidBodyError(err error) *ApiError {
	return NewApiError(err, "The provided body could not be parsed, please check your body", ValidationAppErrType, BodyInvalidErrCode, InvalidBodyErrStrCode, http.StatusBadRequest)
}

func NewUnexpectedError(err error) *ApiError {
	return NewApiError(err, "An enexpected error occured", AlertAppErrType, UnexpectedErrCode, UnexpectedErrStrCode, http.StatusInternalServerError)
}

func NewUnauthorizedError() *ApiError {
	return NewApiError(errors.New("unauthorized"), "Unauthorized", AlertAppErrType, UnauthorizedErrCode, UnauthorizedErrStrCode, http.StatusUnauthorized)
}
func NewForbiddenError() *ApiError {
	return NewApiError(errors.New("forbidden"), "Forbidden", AlertAppErrType, ForbiddenErrCode, ForbiddenErrStrCode, http.StatusForbidden)
}

type ApiError struct {
	cause error

	Message    string
	Code       ErrorCode
	StrCode    ErrorStringCode
	StatusCode int

	DisplayType ErrorDisplayType
}

func (err *ApiError) Error() string {
	return err.cause.Error()
}

func NewApiError(cause error, message string, displayType ErrorDisplayType, code ErrorCode, strCode ErrorStringCode, statusCode int) *ApiError {
	return &ApiError{
		cause:       cause,
		Message:     message,
		Code:        code,
		StrCode:     strCode,
		StatusCode:  statusCode,
		DisplayType: displayType,
	}
}

type ErrorDisplayType int

const (
	AlertAppErrType        ErrorDisplayType = 0
	ValidationAppErrType   ErrorDisplayType = 1
	NotificationAppErrType ErrorDisplayType = 2
)

type ErrorCode int

const (
	UnexpectedErrCode       ErrorCode = 001
	UnauthorizedErrCode     ErrorCode = 101
	ForbiddenErrCode        ErrorCode = 102
	BodyInvalidErrCode      ErrorCode = 201
	FieldMissingErrCode     ErrorCode = 202
	FieldInvalidErrCode     ErrorCode = 203
	ResourceNotFoundErrCode ErrorCode = 204
)

type ErrorStringCode string

const (
	UnexpectedErrStrCode       ErrorStringCode = "UNEXPECTED"
	UnauthorizedErrStrCode     ErrorStringCode = "UNAUTHORIZED"
	ForbiddenErrStrCode        ErrorStringCode = "FORBIDDEN"
	InvalidBodyErrStrCode      ErrorStringCode = "BODY_INVALID"
	FieldMissingErrStrCode     ErrorStringCode = "FIELD_MISSING"
	FieldInvalidErrStrCode     ErrorStringCode = "FIELD_INVALID"
	ResourceNotFoundErrStrCode ErrorStringCode = "RESOURCE_NOT_FOUND"
)

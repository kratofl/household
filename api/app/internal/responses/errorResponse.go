package responses

import "github.com/kratofl/budget/app/internal/errors"

type ErrorResponse struct {
	Errors []ErrorDetail `json:"errors"`
}

type ErrorDetail struct {
	Field       string                  `json:"field,omitempty"`
	Message     string                  `json:"message"`
	Code        errors.ErrorCode        `json:"code"`
	StrCode     errors.ErrorStringCode  `json:"strCode"`
	DisplayType errors.ErrorDisplayType `json:"displayType"`
}

func ApiErrToResponse(err errors.ApiError) *ErrorDetail {
	errDetail := &ErrorDetail{
		Code:        err.Code,
		StrCode:     err.StrCode,
		Message:     err.Message,
		DisplayType: err.DisplayType,
	}
	return errDetail
}

func ValidationErrToResponse(err errors.ValidationError) *ErrorDetail {
	errDetail := &ErrorDetail{
		Code:        err.ApiError.Code,
		StrCode:     err.ApiError.StrCode,
		Message:     err.ApiError.Message,
		DisplayType: err.ApiError.DisplayType,
		Field:       err.Field,
	}
	return errDetail
}

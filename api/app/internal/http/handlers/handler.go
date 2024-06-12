package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	appErrs "github.com/kratofl/budget/app/internal/errors"
	"github.com/kratofl/budget/app/internal/responses"
	"github.com/kratofl/budget/core/pkg/logger"
	dataErrs "github.com/kratofl/budget/data/pkg/errors"
)

func Write(w http.ResponseWriter, status int) {
	w.WriteHeader(status)
}
func WriteJSON(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	return json.NewEncoder(w).Encode(v)
}

type ApiFunc func(http.ResponseWriter, *http.Request) []error

func NewHttpHandlerFunc(f ApiFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		errs := f(w, r)
		if errs != nil {
			HandleErrors(w, errs)
		}
	}
}

func HandleErrors(w http.ResponseWriter, errs []error) {
	var errorResponse = responses.ErrorResponse{}

	statusCode := http.StatusInternalServerError
	for _, err := range errs {
		var errDetail *responses.ErrorDetail

		var apiErr *appErrs.ApiError
		if errors.As(err, &apiErr) {
			errDetail = responses.ApiErrToResponse(*apiErr)

			var validationErr *appErrs.ValidationError
			if errors.As(err, &validationErr) {
				errDetail.Field = validationErr.Field
				statusCode = http.StatusBadRequest
			}

			var dataErr *dataErrs.DataError
			if errors.As(err, &dataErr) {
				logger.Error("database error", logger.Attr("err", err), logger.Attr("table", dataErr.Table), logger.Attr("action", dataErr.Action))
			} else {
				logger.ErrorWithErr("handler error, user received error response", err)
			}
		} else {
			errDetail = responses.ApiErrToResponse(*appErrs.NewUnexpectedError(err))
		}

		if errDetail != nil {
			errorResponse.Errors = append(errorResponse.Errors, *errDetail)
		}
	}
	if errorResponse.Errors != nil {
		WriteJSON(w, statusCode, errorResponse)
		return
	}
}

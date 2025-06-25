package err

import (
	"encoding/json"
	"net/http"

	"github.com/kratofl/household/budget/pkg/ctx"
)

var (
	RespDBDataInsertFailure = "db data insert failure"
	RespDBDataAccessFailure = "db data access failure"
	RespDBDataUpdateFailure = "db data update failure"
	RespDBDataRemoveFailure = "db data remove failure"

	RespJSONEncodeFailure = "json encode failure"
	RespJSONDecodeFailure = "json decode failure"

	RespInvalidURLParamID = "invalid url param-id"
)

const (
	errTypeBadRequest  = "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1"
	errTypeServerError = "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.1"
)

type ProblemDetails struct {
	Type      string      `json:"type"`
	Title     string      `json:"title"`
	Status    int         `json:"status"`
	Detail    string      `json:"detail,omitempty"`
	Instance  string      `json:"instance,omitempty"`
	Errors    interface{} `json:"errors,omitempty"`
	RequestId string      `json:"requestId"`
}

func ServerError(w http.ResponseWriter, r *http.Request, title string, detail string) {
	w.WriteHeader(http.StatusInternalServerError)

	writeProblemDetails(w, ProblemDetails{
		Type:      errTypeServerError,
		Instance:  r.URL.Path,
		Status:    http.StatusInternalServerError,
		Title:     title,
		Detail:    detail,
		RequestId: ctx.RequestID(r.Context()),
	})
}

func BadRequest(w http.ResponseWriter, r *http.Request, title string, detail string) {
	w.WriteHeader(http.StatusBadRequest)

	writeProblemDetails(w, ProblemDetails{
		Type:      errTypeBadRequest,
		Instance:  r.URL.Path,
		Status:    http.StatusBadRequest,
		Title:     title,
		Detail:    detail,
		RequestId: ctx.RequestID(r.Context()),
	})
}

func WriteValidationProblem(w http.ResponseWriter, r *http.Request, title string, detail string, reps []byte) {
	w.WriteHeader(http.StatusUnprocessableEntity)
	w.Write(reps)

	writeProblemDetails(w, ProblemDetails{
		Type:      errTypeBadRequest,
		Instance:  r.URL.Path,
		Status:    http.StatusBadRequest,
		Title:     title,
		Detail:    detail,
		RequestId: ctx.RequestID(r.Context()),
		Errors:    reps,
	})
}

func writeProblemDetails(w http.ResponseWriter, pd ProblemDetails) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(pd.Status)
	json.NewEncoder(w).Encode(pd)
}

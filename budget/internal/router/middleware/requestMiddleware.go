package middleware

import (
	"net/http"

	"github.com/google/uuid"
	ctxPkg "github.com/kratofl/household/budget/pkg/ctx"
)

const requestIDHeaderKey = "X-Request-ID"

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		requestID := r.Header.Get(requestIDHeaderKey)
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx = ctxPkg.SetRequestID(ctx, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

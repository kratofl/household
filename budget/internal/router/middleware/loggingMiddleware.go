package middleware

import (
	"net/http"

	"github.com/kratofl/household/budget/pkg/config"
	ctxPkg "github.com/kratofl/household/budget/pkg/ctx"
	e "github.com/kratofl/household/budget/pkg/err"
	"github.com/kratofl/household/budget/pkg/logging"
	"github.com/rs/zerolog"
)

func LoggingMiddleware(c *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := ctxPkg.RequestID(r.Context())

			l, err := logging.New(c)
			if err != nil {
				// ToDo: Logger Fallback
				e.ServerError(w, r, "Server run into an error", "Server run into an error")
				return
			}
			logger := l.Logger

			logger.UpdateContext(func(c zerolog.Context) zerolog.Context {
				return c.Str(logging.KeyReqID, reqID)
			})

			ctx := logger.WithContext(r.Context())
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

package http

import (
	"net/http"
	"time"

	"household/backend/internal/platform/config"
	"household/backend/internal/platform/logging"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/hlog"
)

type Feature interface {
	RegisterRoutes(chi.Router)
}

func NewRouter(c *config.Config, logger *logging.AppLogger, v *validator.Validate, features ...Feature) *chi.Mux {
	r := chi.NewRouter()
	r.Use(requestLogger(logger.Logger)...)
	r.Use(contentTypeJSON)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	r.Route("/api/v1", func(r chi.Router) {
		for _, feature := range features {
			feature.RegisterRoutes(r)
		}
	})

	return r
}

func contentTypeJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json;charset=utf8")
		next.ServeHTTP(w, r)
	})
}

func requestLogger(logger zerolog.Logger) []func(http.Handler) http.Handler {
	return []func(http.Handler) http.Handler{
		hlog.NewHandler(logger),
		hlog.AccessHandler(func(r *http.Request, status, size int, duration time.Duration) {
			hlog.FromRequest(r).Info().
				Str("method", r.Method).
				Stringer("url", r.URL).
				Int("status", status).
				Int("size", size).
				Dur("duration", duration).
				Msg("Request completed")
		}),
		hlog.RemoteAddrHandler("ip"),
		hlog.UserAgentHandler("user_agent"),
		hlog.RequestIDHandler("req_id", "Request-Id"),
	}
}

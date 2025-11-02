package router

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/kratofl/household/identity/internal/resource/auth"
	"github.com/kratofl/household/identity/internal/resource/user"
	"github.com/kratofl/household/shared/pkg/config"
	"github.com/kratofl/household/shared/pkg/http/middleware"
	"github.com/kratofl/household/shared/pkg/logging"
	"github.com/rs/zerolog/hlog"
	"gorm.io/gorm"
)

func New(c *config.Config, v *validator.Validate, db *gorm.DB, logger *logging.AppLogger) *chi.Mux {
	r := chi.NewRouter()
	r.Use(hlog.NewHandler(logger.Logger))
	r.Use(hlog.AccessHandler(func(r *http.Request, status, size int, duration time.Duration) {
		hlog.FromRequest(r).Info().
			Str("method", r.Method).
			Stringer("url", r.URL).
			Int("status", status).
			Int("size", size).
			Dur("duration", duration).
			Msg("Request completed")
	}))
	r.Use(hlog.RemoteAddrHandler("ip"))
	r.Use(hlog.UserAgentHandler("user_agent"))
	r.Use(hlog.RequestIDHandler("req_id", "Request-Id"))
	r.Use(middleware.ContentTypeJSON)

	r.Route("/api/v1", func(r chi.Router) {
		initializeUserRoutes(r, v, db)
		initializeAuthRoutes(r, v, db)
	})
	return r
}

func initializeUserRoutes(r chi.Router, v *validator.Validate, db *gorm.DB) {
	r.Route("/users", func(r chi.Router) {
		userAPI := user.New(v, db)
		r.Method(http.MethodGet, "/", http.HandlerFunc(userAPI.List))
		r.Method(http.MethodPut, "/", http.HandlerFunc(userAPI.Create))
		r.Method(http.MethodGet, "/{id}", http.HandlerFunc(userAPI.Read))
	})
}

func initializeAuthRoutes(r chi.Router, v *validator.Validate, db *gorm.DB) {
	r.Route("/auth", func(r chi.Router) {
		authApi := auth.New(db)
		r.Method(http.MethodPost, "/authorize", http.HandlerFunc(authApi.Authorize))
	})
}

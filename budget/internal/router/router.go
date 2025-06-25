package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/kratofl/household/budget/internal/resource/user"
	"github.com/kratofl/household/budget/internal/router/middleware"
	"github.com/kratofl/household/budget/internal/router/middleware/requestlog"
	"github.com/kratofl/household/budget/pkg/config"
	"gorm.io/gorm"
)

func New(c *config.Config, v *validator.Validate, db *gorm.DB) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.ContentTypeJSON)
	r.Use(middleware.LoggingMiddleware(c))

	r.Route("/api/v1", func(r chi.Router) {
		initializeUserRoutes(r, c, v, db)
	})
	return r
}

func initializeUserRoutes(r chi.Router, c *config.Config, v *validator.Validate, db *gorm.DB) {
	r.Route("/users", func(r chi.Router) {
		userAPI := user.New(v, db)
		r.Method(http.MethodGet, "/", requestlog.NewHandler(userAPI.List))
		r.Method(http.MethodGet, "/{id}", requestlog.NewHandler(userAPI.Read))
	})
}

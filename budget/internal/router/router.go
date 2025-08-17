package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/kratofl/household/shared/pkg/config"
	"github.com/kratofl/household/shared/pkg/http/middleware"
	"gorm.io/gorm"
)

func New(c *config.Config, v *validator.Validate, db *gorm.DB) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.ContentTypeJSON)
	r.Use(middleware.LoggingMiddleware(c))

	r.Route("/api/v1", func(r chi.Router) {
	})
	return r
}

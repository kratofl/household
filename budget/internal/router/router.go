package router

import (
	"household/shared/pkg/config"
	"household/shared/pkg/http/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

func New(c *config.Config, v *validator.Validate, db *gorm.DB) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.ContentTypeJSON)

	r.Route("/api/v1", func(r chi.Router) {
	})
	return r
}

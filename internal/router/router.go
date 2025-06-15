package router

import (
	"net/http"

	"github.com/go-chi/chi"
	"github.com/go-playground/validator/v10"
	"github.com/kratofl/budget-api/internal/resource/user"
	"github.com/kratofl/budget-api/internal/router/middleware"
	"github.com/kratofl/budget-api/internal/router/middleware/requestlog"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func New(l *zerolog.Logger, v *validator.Validate, db *gorm.DB) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.ContentTypeJSON)

	r.Route("/api/v1", func(r chi.Router) {
		initializeUserRoutes(r, l, v, db)
	})

	return r
}

func initializeUserRoutes(r chi.Router, l *zerolog.Logger, v *validator.Validate, db *gorm.DB) {
	r.Route("/users", func(r chi.Router) {
		userAPI := user.New(l, v, db)
		r.Method(http.MethodGet, "/", requestlog.NewHandler(userAPI.List, l))
		r.Method(http.MethodGet, "/{id}", requestlog.NewHandler(userAPI.Read, l))
	})
}

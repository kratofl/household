package router

import (
	"github.com/go-chi/chi"
	"github.com/kratofl/budget-api/internal/handlers"
	"github.com/kratofl/budget-api/internal/services"
)

func New() *chi.Mux {
	r := chi.NewRouter()
	// r.Use(middleware.Logger)
	// r.Use(middleware.Recoverer)

	r.Route("/api/v1", func(r chi.Router) {
		initializeUserRoutes(r)
	})

	//r.Get("/health", handlers.HealthCheck)
	return r
}

func initializeUserRoutes(r chi.Route) {
	userRepo := repositories.new
	userService := services.NewUserService()
	userHandler := handlers.NewUserHandler()
	r.Route("/users", func(r chi.Router) {
		r.Get("/{id}", userHandler.GetOneUser)
	})
}

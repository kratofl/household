package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/kratofl/budget-api/internal/services"
)

type UserHandler struct {
	service *services.UserService
}

func NewUserHandler(s *services.UserService) *UserHandler {
	return &UserHandler{service: s}
}

func (h *UserHandler) GetOneUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	fmt.Fprintf(w, "User ID: %s", id)
}

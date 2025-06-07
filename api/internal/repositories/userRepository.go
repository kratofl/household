package repositories

import (
	"database/sql"

	"github.com/google/uuid"
	"github.com/kratofl/budget-api/internal/models"
)

type UserRepository struct {
	db *sql.DB
}

func (r *UserRepository) FindById(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.QueryRow("SELECT id, name, email, active FROM users WHERE id = ?", id).Scan(&user.Id, &user.Name, &user.Email, &user.Active)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

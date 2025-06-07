package services

import (
	"github.com/google/uuid"
	"github.com/kratofl/budget-api/internal/repositories"
)

type UserService struct {
	repo *repositories.UserRepository
}

func NewUserService(repo *repositories.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) GetOne(id uuid.UUID) error {
	_, err := s.repo.FindById(id)
	return err
}

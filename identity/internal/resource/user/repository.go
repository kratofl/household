package user

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

func (r *UserRepository) List() (Users, error) {
	users := make([]*User, 0)
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}

	return users, nil
}

func (r *UserRepository) Create(user *User) (*User, error) {
	if err := r.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) Read(id uuid.UUID) (*User, error) {
	user := &User{}
	if err := r.db.Where("id = ?", id).First(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) ReadByName(username string) (*User, error) {
	user := &User{}
	result := r.db.Model(&User{}).Where("name = ?", strings.ToLower(username)).First(user)

	if result.Error != nil {
		return nil, errors.Join(errors.New("failed to read user by name"), result.Error)
	}

	return user, nil
}

func (r *UserRepository) Update(user *User) (int64, error) {
	result := r.db.Model(&User{}).
		Select("id", "name", "email").
		Where("id = ?", user.Id).
		Updates(user)

	return result.RowsAffected, result.Error
}

func (r *UserRepository) Delete(id uuid.UUID) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&User{})

	return result.RowsAffected, result.Error
}

func (r *UserRepository) AnyByName(username string) (bool, error) {
	var count int64
	result := r.db.Model(&User{}).Where("name = ?", strings.ToLower(username)).Count(&count)

	if result.Error != nil {
		return false, fmt.Errorf("failed to count users: %v", result.Error)
	}

	return count > 0, nil
}

func (r *UserRepository) AnyByEmail(email string) (bool, error) {
	var count int64
	result := r.db.Model(&User{}).Where("email = ?", strings.ToLower(email)).Count(&count)

	if result.Error != nil {
		return false, fmt.Errorf("failed to count users: %v", result.Error)
	}

	return count > 0, nil
}

package user

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserDTO struct {
	Id    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type UserCreateDTO struct {
	Name     string `json:"name" validate:"required,max=255"`
	Email    string `json:"email" validate:"required,max=255"`
	Password string `json:"password" validate:"required,max=255"`
}

type User struct {
	Id           uuid.UUID `gorm:"primarykey;type=uuid;default:uuidv7()"`
	Name         string
	Email        string
	PasswordHash string `gorm:"column:password_hash"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Users []*User

func (u *User) ToDto() *UserDTO {
	return &UserDTO{
		Id:    u.Id.String(),
		Name:  u.Name,
		Email: u.Email,
	}
}

func (u *User) VerifyPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

func (urs Users) ToDto() []*UserDTO {
	dtos := make([]*UserDTO, len(urs))
	for i, v := range urs {
		dtos[i] = v.ToDto()
	}

	return dtos
}

func (f *UserCreateDTO) ToModel() (*User, error) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(f.Password), 14)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %s", err)
	}

	return &User{
		Name:         strings.ToLower(f.Name),
		Email:        strings.ToLower(f.Email),
		PasswordHash: string(passwordHash),
	}, nil
}

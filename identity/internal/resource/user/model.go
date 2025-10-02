package user

import "github.com/google/uuid"

type UserDTO struct {
	Id    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type UserCreateUpdateDTO struct {
	Name  string `json:"name" validate:"required,max=255"`
	Email string `json:"email" validate:"required,max=255"`
}

type User struct {
	Id           uuid.UUID `gorm:"primarykey"`
	Name         string
	Email        string
	PasswordHash string
}

type Users []*User

func (u *User) ToDto() *UserDTO {
	return &UserDTO{
		Id:    u.Id.String(),
		Name:  u.Name,
		Email: u.Email,
	}
}

func (urs Users) ToDto() []*UserDTO {
	dtos := make([]*UserDTO, len(urs))
	for i, v := range urs {
		dtos[i] = v.ToDto()
	}

	return dtos
}

func (f *UserCreateUpdateDTO) ToModel() *User {
	return &User{
		Name:  f.Name,
		Email: f.Email,
	}
}

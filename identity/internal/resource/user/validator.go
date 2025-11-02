package user

import (
	"context"

	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog"
)

type UserValidator struct {
	r *UserRepository
}

func NewUserValidator(r *UserRepository) *UserValidator {
	return &UserValidator{
		r: r,
	}
}

func (v *UserValidator) UserCreateStructLevelValidation(ctx context.Context, sl validator.StructLevel) {
	user := sl.Current().Interface().(UserCreateDTO)
	logger := zerolog.Ctx(ctx)

	exists, err := v.r.AnyByEmail(user.Email)
	if err != nil {
		logger.Error().Err(err).Msg("Could not execute AnyByEmail")
		sl.ReportError(user.Email, "email", "email", "uniqueemail", "")
	}
	if exists {
		sl.ReportError(user.Email, "email", "email", "uniqueemail", "")
	}
}

package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/kratofl/household/identity/internal/resource/user"
	e "github.com/kratofl/household/shared/pkg/err"
	"github.com/kratofl/household/shared/pkg/validator"
	"github.com/rs/zerolog/hlog"
	"gorm.io/gorm"
)

type AuthHandler struct {
	userRepository *user.UserRepository
}

func New(db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		userRepository: user.NewUserRepository(db),
	}
}

func (h *AuthHandler) Authorize(w http.ResponseWriter, r *http.Request) {
	logger := hlog.FromRequest(r)

	form := &AuthorizeDTO{}
	logger.Debug().Msg("Decode")
	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		logger.Error().Err(err).Msg("Could not decode authorize body")
		e.BadRequest(w, r, "JSON parsing failed", "Your JSON-Payload was not in the correct format")
		return
	}
	logger.Debug().Msg("DONE Decode")

	logger.Debug().Msg("Reading db")
	usr, err := h.userRepository.ReadByName(form.Username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			validationErros := []validator.ValidationError{
				validator.NewValidationError("username", "This user is not registered"),
			}

			e.WriteValidationProblem(w, r, "Invalid Login", "UserName could not be found", &validationErros)
			return
		}

		logger.Error().Err(err).Msg("Unexpected Error, faile to access db")
		e.ServerError(w, r, "Unexpected Error", e.RespDBDataAccessFailure)
		return
	}
	logger.Debug().Msg("DONE Reading db")

	logger.Debug().Msg("Verify password")
	passwordCorrect := usr.VerifyPassword(form.Password)
	if !passwordCorrect {
		validationErros := []validator.ValidationError{
			validator.NewValidationError("username", "Invalid username"),
			validator.NewValidationError("password", "Invalid password"),
		}

		e.WriteValidationProblem(w, r, "Invalid Login", "UserName or Password incorrect", &validationErros)
		return
	}
	logger.Debug().Msg("Request Done")
}

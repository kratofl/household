package user

import (
	"encoding/json"
	"fmt"
	"net/http"

	e "household/shared/pkg/err"
	v "household/shared/pkg/validator"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/rs/zerolog/hlog"
	"gorm.io/gorm"
)

type UserHandler struct {
	validator  *validator.Validate
	repository *UserRepository
}

func New(validator *validator.Validate, db *gorm.DB) *UserHandler {
	r := NewUserRepository(db)
	userValidator := NewUserValidator(r)
	validator.RegisterStructValidationCtx(userValidator.UserCreateStructLevelValidation, UserCreateDTO{})

	return &UserHandler{
		validator:  validator,
		repository: r,
	}
}

func (a *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	logger := hlog.FromRequest(r)

	users, err := a.repository.List()
	if err != nil {
		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataAccessFailure)
		return
	}

	if len(users) == 0 {
		fmt.Fprint(w, "[]")
		return
	}

	if err := json.NewEncoder(w).Encode(users.ToDto()); err != nil {
		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
		return
	}
}

func (a *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	logger := hlog.FromRequest(r)

	form := &UserCreateDTO{}
	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONDecodeFailure)
		return
	}

	if err := a.validator.StructCtx(r.Context(), form); err != nil {
		errResponse := v.ToErrResponse(err)

		logger.Info().Msg("Validation failed")
		e.WriteValidationProblem(w, r, "Validation failed", "See errors", errResponse)
		return
	}

	newUser, modelErr := form.ToModel()
	if modelErr != nil {
		logger.Error().Err(modelErr).Msg("Parsing UserCreateDTO to User failed")
		e.ServerError(w, r, "Server run into an error", "Parsing data failed")
		return
	}

	user, err := a.repository.Create(newUser)
	if err != nil {
		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataInsertFailure)
		return
	}

	logger.Info().Str("id", user.Id.String()).Msg("new user created")
	w.WriteHeader(http.StatusCreated)
}

func (a *UserHandler) Read(w http.ResponseWriter, r *http.Request) {
	logger := hlog.FromRequest(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		e.BadRequest(w, r, e.RespInvalidURLParamID, "Field 'id' could not be parsed")
		return
	}

	user, err := a.repository.Read(id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataAccessFailure)
		return
	}

	dto := user.ToDto()
	if err := json.NewEncoder(w).Encode(dto); err != nil {
		logger.Error().Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
		return
	}
}

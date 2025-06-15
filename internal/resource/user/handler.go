package user

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/kratofl/budget-api/pkg/ctx"
	e "github.com/kratofl/budget-api/pkg/err"
	l "github.com/kratofl/budget-api/pkg/logging"
	v "github.com/kratofl/budget-api/pkg/validator"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

type UserAPI struct {
	logger     *zerolog.Logger
	validator  *validator.Validate
	repository *UserRepository
}

func New(logger *zerolog.Logger, validator *validator.Validate, db *gorm.DB) *UserAPI {
	return &UserAPI{
		logger:     logger,
		validator:  validator,
		repository: NewUserRepository(db),
	}
}

func (a *UserAPI) List(w http.ResponseWriter, r *http.Request) {
	reqID := ctx.RequestID(r.Context())

	users, err := a.repository.List()
	if err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataAccessFailure)
		return
	}

	if len(users) == 0 {
		fmt.Fprint(w, "[]")
		return
	}

	if err := json.NewEncoder(w).Encode(users.ToDto()); err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
		return
	}
}

func (a *UserAPI) Create(w http.ResponseWriter, r *http.Request) {
	reqID := ctx.RequestID(r.Context())

	form := &UserCreateUpdateDTO{}
	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONDecodeFailure)
		return
	}

	if err := a.validator.Struct(form); err != nil {
		respBody, err := json.Marshal(v.ToErrResponse(err))
		if err != nil {
			a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
			e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
			return
		}

		e.WriteValidationProblem(w, r, "Validation failed", "See errors", respBody)
		return
	}

	newUser := form.ToModel()
	newUser.Id = uuid.New()

	user, err := a.repository.Create(newUser)
	if err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Str(l.KeyReqID, reqID).Str("id", user.Id.String()).Msg("new user created")
	w.WriteHeader(http.StatusCreated)
}

func (a *UserAPI) Read(w http.ResponseWriter, r *http.Request) {
	reqID := ctx.RequestID(r.Context())

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

		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataAccessFailure)
		return
	}

	dto := user.ToDto()
	if err := json.NewEncoder(w).Encode(dto); err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
		return
	}
}

func (a *UserAPI) Update(w http.ResponseWriter, r *http.Request) {
	reqID := ctx.RequestID(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		e.BadRequest(w, r, e.RespInvalidURLParamID, "Field 'id' could not be parsed")
		return
	}

	form := &UserCreateUpdateDTO{}
	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespJSONDecodeFailure)
		return
	}

	if err := a.validator.Struct(form); err != nil {
		respBody, err := json.Marshal(v.ToErrResponse(err))
		if err != nil {
			a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
			e.ServerError(w, r, "Server run into an error", e.RespJSONEncodeFailure)
			return
		}

		e.WriteValidationProblem(w, r, "Validation failed", "See errors", respBody)
		return
	}

	user := form.ToModel()
	user.Id = id

	rows, err := a.repository.Update(user)
	if err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataUpdateFailure)
		return
	}
	if rows == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	a.logger.Info().Str(l.KeyReqID, reqID).Str("id", id.String()).Msg("book updated")
}

func (a *UserAPI) Delete(w http.ResponseWriter, r *http.Request) {
	reqID := ctx.RequestID(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		e.BadRequest(w, r, e.RespInvalidURLParamID, "Field 'id' could not be parsed")
		return
	}

	rows, err := a.repository.Delete(id)
	if err != nil {
		a.logger.Error().Str(l.KeyReqID, reqID).Err(err).Msg("")
		e.ServerError(w, r, "Server run into an error", e.RespDBDataRemoveFailure)
		return
	}
	if rows == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	a.logger.Info().Str(l.KeyReqID, reqID).Str("id", id.String()).Msg("book deleted")
}

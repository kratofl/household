package validator

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

type ValidationError struct {
	Pointer string `json:"pointer"`
	Detail  string `json:"detail"`
}

func NewValidationError(pointer string, detail string) ValidationError {
	return ValidationError{
		Pointer: pointer,
		Detail:  detail,
	}
}

func New() *validator.Validate {
	validate := validator.New()

	// Using the names which have been specified for JSON representations of structs, rather than normal Go field names
	validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})

	return validate
}

func ToErrResponse(err error) *[]ValidationError {
	if fieldErrors, ok := err.(validator.ValidationErrors); ok {
		resp := make([]ValidationError, len(fieldErrors))

		for i, err := range fieldErrors {
			switch err.Tag() {
			case "required":
				resp[i] = ValidationError{
					Pointer: err.Field(),
					Detail:  "is required",
				}
			case "max":
				resp[i] = ValidationError{
					Pointer: err.Field(),
					Detail:  fmt.Sprintf("must be a maximum of %s in length", err.Param()),
				}
			case "url":
				resp[i] = ValidationError{
					Pointer: err.Field(),
					Detail:  "must be a valid URL",
				}
			case "alpha_space":
				resp[i] = ValidationError{
					Pointer: err.Field(),
					Detail:  "can only contain alphabetic and space characters",
				}
			case "datetime":
				if err.Param() == "2006-01-02" {
					resp[i] = ValidationError{
						Pointer: err.Field(),
						Detail:  "must be a valid date",
					}
				} else {
					resp[i] = ValidationError{
						Pointer: err.Field(),
						Detail:  fmt.Sprintf("must follow %s format", err.Param()),
					}
				}
			default:
				resp[i] = ValidationError{
					Pointer: err.Field(),
					Detail:  err.Error(),
				}
			}
		}

		return &resp
	}

	return nil
}

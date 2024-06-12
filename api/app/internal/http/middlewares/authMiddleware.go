package middlewares

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/kratofl/budget/app/internal/errors"
	"github.com/kratofl/budget/app/internal/http/handlers"
)

func AuthMiddleware(next http.Handler) http.Handler {
	fmt.Println("Auth")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lowerUrl := strings.ToLower(r.URL.Path)
		if strings.Contains(lowerUrl, "login") || strings.Contains(lowerUrl, "logout") || strings.Contains(lowerUrl, "register") {
			next.ServeHTTP(w, r)
			return
		}

		bearerToken := r.Header.Get("Authorization")
		if bearerToken == "" {
			handlers.HandleErrors(w, []error{errors.NewUnauthorizedError()})
			return
		}

		fmt.Println(strings.Replace(bearerToken, "Bearer ", "", -1))

		next.ServeHTTP(w, r)
	})
}

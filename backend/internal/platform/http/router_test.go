package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"household/backend/internal/platform/config"
	"household/backend/internal/platform/logging"
	"household/backend/internal/platform/validation"

	"github.com/go-chi/chi/v5"
)

type testFeature struct{}

func (testFeature) RegisterRoutes(r chi.Router) {
	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
}

func TestNewRouterRegistersHealthAndFeatures(t *testing.T) {
	logger, err := logging.New(&config.Config{}, "test")
	if err != nil {
		t.Fatalf("logging.New() returned error: %v", err)
	}
	defer logger.Close()

	r := NewRouter(&config.Config{}, logger, validation.New(), testFeature{})

	tests := []struct {
		name string
		path string
		want int
	}{
		{name: "health", path: "/healthz", want: http.StatusOK},
		{name: "feature", path: "/api/v1/test", want: http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}

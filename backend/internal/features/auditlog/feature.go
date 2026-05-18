package auditlog

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"household/backend/internal/features/identity"
	"household/backend/internal/platform/audit"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

type Feature struct {
	db *gorm.DB
}

func NewFeature(db *gorm.DB) *Feature {
	return &Feature{db: db}
}

func (f *Feature) RegisterRoutes(r chi.Router) {
	r.Get("/audit/events", f.listEvents)
}

func (f *Feature) listEvents(w http.ResponseWriter, r *http.Request) {
	if _, ok := f.requireAdmin(w, r); !ok {
		return
	}
	limit := 100
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 500 {
			writeProblem(w, http.StatusBadRequest, "Invalid limit", "Limit must be between 1 and 500")
			return
		}
		limit = parsed
	}
	var events []audit.Event
	if err := f.db.Order("occurred_at DESC").Limit(limit).Find(&events).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not list audit events")
		return
	}
	writeJSON(w, http.StatusOK, events)
}

func (f *Feature) requireAdmin(w http.ResponseWriter, r *http.Request) (*identity.User, bool) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return nil, false
	}
	if user.Role != identity.RoleAdmin {
		writeProblem(w, http.StatusForbidden, "Forbidden", "Admin role required")
		return nil, false
	}
	return user, true
}

func (f *Feature) requireUser(w http.ResponseWriter, r *http.Request) (*identity.User, bool) {
	auth := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || token == "" {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing bearer token")
		return nil, false
	}
	var session identity.Session
	err := f.db.Preload("User").
		Where("access_token_hash = ? AND revoked_at IS NULL", hashToken(token)).
		First(&session).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			writeProblem(w, http.StatusInternalServerError, "Database error", "Could not read session")
			return nil, false
		}
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid bearer token")
		return nil, false
	}
	if time.Now().After(session.AccessExpiresAt) || session.User.Status != identity.StatusActive {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Bearer token expired")
		return nil, false
	}
	return &session.User, true
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeProblem(w http.ResponseWriter, status int, title string, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  title,
		"status": status,
		"detail": detail,
	})
}

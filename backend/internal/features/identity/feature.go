package identity

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"household/backend/internal/platform/audit"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	StatusPending = "pending"
	StatusActive  = "active"
	StatusBlocked = "blocked"
)

type Feature struct {
	db        *gorm.DB
	auditRepo *audit.Repository
}

func NewFeature(db *gorm.DB, auditRepo *audit.Repository) *Feature {
	return &Feature{db: db, auditRepo: auditRepo}
}

func (f *Feature) RegisterRoutes(r chi.Router) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/authorize", f.authorize)
		r.Post("/refresh", f.refresh)
		r.Post("/logout", f.logout)
	})

	r.Route("/users", func(r chi.Router) {
		r.Get("/", f.listUsers)
		r.Put("/", f.createUser)
		r.Get("/me", f.me)
		r.Put("/me/password", f.changePassword)
	})

	r.Route("/modules", func(r chi.Router) {
		r.Get("/", f.listModules)
		r.Patch("/active", f.setActiveModules)
	})

	r.Get("/identity/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

type User struct {
	ID           uuid.UUID `gorm:"column:id;primaryKey;type:uuid;default:uuidv7()" json:"id"`
	Name         string    `gorm:"column:name" json:"name"`
	Email        string    `gorm:"column:email" json:"email"`
	PasswordHash string    `gorm:"column:password_hash" json:"-"`
	Role         string    `gorm:"column:role" json:"role"`
	Status       string    `gorm:"column:status" json:"status"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (User) TableName() string {
	return "identity.users"
}

type Module struct {
	ID          uuid.UUID `gorm:"column:id;primaryKey;type:uuid;default:uuidv7()" json:"id"`
	Key         string    `gorm:"column:key" json:"key"`
	Name        string    `gorm:"column:name" json:"name"`
	Description string    `gorm:"column:description" json:"description"`
	Enabled     bool      `gorm:"column:enabled" json:"enabled"`
	Active      bool      `gorm:"column:active" json:"active"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Module) TableName() string {
	return "identity.modules"
}

type Session struct {
	ID               uuid.UUID  `gorm:"column:id;primaryKey;type:uuid;default:uuidv7()"`
	UserID           uuid.UUID  `gorm:"column:user_id"`
	AccessTokenHash  string     `gorm:"column:access_token_hash"`
	RefreshTokenHash string     `gorm:"column:refresh_token_hash"`
	AccessExpiresAt  time.Time  `gorm:"column:access_expires_at"`
	RefreshExpiresAt time.Time  `gorm:"column:refresh_expires_at"`
	RevokedAt        *time.Time `gorm:"column:revoked_at"`
	CreatedAt        time.Time  `gorm:"column:created_at"`
	UpdatedAt        time.Time  `gorm:"column:updated_at"`
	User             User       `gorm:"foreignKey:UserID"`
}

func (Session) TableName() string {
	return "identity.sessions"
}

type tokenPair struct {
	AccessToken      string    `json:"accessToken"`
	RefreshToken     string    `json:"refreshToken"`
	AccessExpiresAt  time.Time `json:"accessExpiresAt"`
	RefreshExpiresAt time.Time `json:"refreshExpiresAt"`
}

type authorizeRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type createUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type setActiveModulesRequest struct {
	ModuleIDs []string `json:"moduleIds"`
}

func (f *Feature) authorize(w http.ResponseWriter, r *http.Request) {
	var req authorizeRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	var user User
	if err := f.db.Where("name = ?", strings.ToLower(req.Username)).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeProblem(w, http.StatusUnauthorized, "Invalid login", "Username or password incorrect")
			return
		}
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not read user")
		return
	}
	if user.Status != StatusActive {
		writeProblem(w, http.StatusForbidden, "User inactive", "User is not active")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		writeProblem(w, http.StatusUnauthorized, "Invalid login", "Username or password incorrect")
		return
	}

	pair, err := newTokenPair(time.Now())
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Token error", "Could not create token")
		return
	}
	session := Session{
		UserID:           user.ID,
		AccessTokenHash:  hashToken(pair.AccessToken),
		RefreshTokenHash: hashToken(pair.RefreshToken),
		AccessExpiresAt:  pair.AccessExpiresAt,
		RefreshExpiresAt: pair.RefreshExpiresAt,
	}
	if err := f.db.Create(&session).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not create session")
		return
	}

	writeJSON(w, http.StatusOK, pair)
}

func (f *Feature) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	session, ok := f.sessionByRefreshToken(w, req.RefreshToken)
	if !ok {
		return
	}

	pair, err := newTokenPair(time.Now())
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Token error", "Could not create token")
		return
	}
	updates := map[string]any{
		"access_token_hash":  hashToken(pair.AccessToken),
		"refresh_token_hash": hashToken(pair.RefreshToken),
		"access_expires_at":  pair.AccessExpiresAt,
		"refresh_expires_at": pair.RefreshExpiresAt,
		"revoked_at":         nil,
	}
	if err := f.db.Model(session).Updates(updates).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not refresh session")
		return
	}
	writeJSON(w, http.StatusOK, pair)
}

func (f *Feature) logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	now := time.Now()
	if err := f.db.Model(&Session{}).
		Where("refresh_token_hash = ? AND revoked_at IS NULL", hashToken(req.RefreshToken)).
		Update("revoked_at", now).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not logout")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (f *Feature) listUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := f.requireAdmin(w, r); !ok {
		return
	}
	var users []User
	if err := f.db.Order("name ASC").Find(&users).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not list users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (f *Feature) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Email) == "" || req.Password == "" {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", "Name, email and password are required")
		return
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 14)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Password error", "Could not hash password")
		return
	}
	user := User{
		Name:         strings.ToLower(strings.TrimSpace(req.Name)),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		PasswordHash: string(passwordHash),
		Role:         RoleUser,
		Status:       StatusPending,
	}
	if err := f.db.Create(&user).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not create user")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (f *Feature) me(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (f *Feature) changePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var req changePasswordRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.NewPassword == "" {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", "New password is required")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)) != nil {
		writeProblem(w, http.StatusForbidden, "Invalid password", "Current password is incorrect")
		return
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 14)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Password error", "Could not hash password")
		return
	}
	if err := f.db.Model(&User{}).Where("id = ?", user.ID).Update("password_hash", string(passwordHash)).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not update password")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (f *Feature) listModules(w http.ResponseWriter, r *http.Request) {
	var modules []Module
	if err := f.db.Order("name ASC").Find(&modules).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not list modules")
		return
	}
	writeJSON(w, http.StatusOK, modules)
}

func (f *Feature) setActiveModules(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireAdmin(w, r)
	if !ok {
		return
	}
	var req setActiveModulesRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	ids := make([]uuid.UUID, 0, len(req.ModuleIDs))
	for _, id := range req.ModuleIDs {
		parsed, err := uuid.Parse(id)
		if err != nil {
			f.recordAudit(r, user, "set_active_modules", audit.OutcomeFailure, "invalid_module_id", map[string]any{
				"moduleIds": req.ModuleIDs,
			})
			writeProblem(w, http.StatusBadRequest, "Invalid module id", "A module id could not be parsed")
			return
		}
		ids = append(ids, parsed)
	}
	if err := f.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Module{}).Where("enabled = true").Update("active", false).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		return tx.Model(&Module{}).Where("enabled = true AND id IN ?", ids).Update("active", true).Error
	}); err != nil {
		f.recordAudit(r, user, "set_active_modules", audit.OutcomeFailure, "database_error", map[string]any{
			"moduleIds": req.ModuleIDs,
		})
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not update modules")
		return
	}
	f.recordAudit(r, user, "set_active_modules", audit.OutcomeSuccess, "", map[string]any{
		"moduleIds": req.ModuleIDs,
		"count":     len(req.ModuleIDs),
	})
	w.WriteHeader(http.StatusNoContent)
}

func (f *Feature) sessionByRefreshToken(w http.ResponseWriter, refreshToken string) (*Session, bool) {
	var session Session
	err := f.db.Preload("User").
		Where("refresh_token_hash = ? AND revoked_at IS NULL", hashToken(refreshToken)).
		First(&session).Error
	if err != nil {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid refresh token")
		return nil, false
	}
	if time.Now().After(session.RefreshExpiresAt) || session.User.Status != StatusActive {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Refresh token expired")
		return nil, false
	}
	return &session, true
}

func (f *Feature) requireAdmin(w http.ResponseWriter, r *http.Request) (*User, bool) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return nil, false
	}
	if user.Role != RoleAdmin {
		writeProblem(w, http.StatusForbidden, "Forbidden", "Admin role required")
		return nil, false
	}
	return user, true
}

func (f *Feature) requireUser(w http.ResponseWriter, r *http.Request) (*User, bool) {
	auth := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || token == "" {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing bearer token")
		return nil, false
	}
	var session Session
	err := f.db.Preload("User").
		Where("access_token_hash = ? AND revoked_at IS NULL", hashToken(token)).
		First(&session).Error
	if err != nil {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid bearer token")
		return nil, false
	}
	if time.Now().After(session.AccessExpiresAt) || session.User.Status != StatusActive {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Bearer token expired")
		return nil, false
	}
	return &session.User, true
}

func newTokenPair(now time.Time) (*tokenPair, error) {
	accessToken, err := randomToken()
	if err != nil {
		return nil, err
	}
	refreshToken, err := randomToken()
	if err != nil {
		return nil, err
	}
	return &tokenPair{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  now.Add(15 * time.Minute),
		RefreshExpiresAt: now.Add(30 * 24 * time.Hour),
	}, nil
}

func randomToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", fmt.Errorf("read random token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid JSON", "Request body could not be decoded")
		return false
	}
	return true
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

func (f *Feature) recordAudit(r *http.Request, user *User, action string, outcome string, errorCode string, metadata map[string]any) {
	if f.auditRepo == nil {
		return
	}
	var actorID *string
	actorRole := ""
	if user != nil {
		id := user.ID.String()
		actorID = &id
		actorRole = user.Role
	}
	rawMetadata := []byte("{}")
	if metadata != nil {
		if data, err := json.Marshal(metadata); err == nil {
			rawMetadata = data
		}
	}
	_ = f.auditRepo.Record(r.Context(), &audit.Event{
		ActorUserID: actorID,
		ActorRole:   actorRole,
		Action:      action,
		Module:      "identity",
		TargetType:  "module",
		Outcome:     outcome,
		IP:          r.RemoteAddr,
		UserAgent:   r.UserAgent(),
		Metadata:    rawMetadata,
		ErrorCode:   errorCode,
	})
}

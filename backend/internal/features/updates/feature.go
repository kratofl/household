package updates

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"household/backend/internal/features/identity"
	"household/backend/internal/platform/audit"
	"household/backend/internal/platform/config"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

type Feature struct {
	db         *gorm.DB
	cfg        config.ConfigUpdates
	auditRepo  *audit.Repository
	httpClient *http.Client
}

func NewFeature(db *gorm.DB, cfg config.ConfigUpdates, auditRepo *audit.Repository) *Feature {
	return &Feature{
		db:        db,
		cfg:       cfg,
		auditRepo: auditRepo,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

func (f *Feature) RegisterRoutes(r chi.Router) {
	r.Route("/updates", func(r chi.Router) {
		r.Get("/candidates", f.candidates)
		r.Get("/status", f.status)
		r.Post("/jobs", f.startJob)
	})
}

type candidate struct {
	Version      string    `json:"version"`
	Channel      string    `json:"channel"`
	Name         string    `json:"name"`
	Prerelease   bool      `json:"prerelease"`
	PublishedAt  time.Time `json:"publishedAt"`
	HTMLURL      string    `json:"htmlUrl"`
	ReleaseNotes string    `json:"releaseNotes"`
	ManifestURL  string    `json:"manifestUrl,omitempty"`
}

type githubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Draft       bool          `json:"draft"`
	Prerelease  bool          `json:"prerelease"`
	PublishedAt time.Time     `json:"published_at"`
	HTMLURL     string        `json:"html_url"`
	Body        string        `json:"body"`
	Assets      []githubAsset `json:"assets"`
}

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type startJobRequest struct {
	Version string `json:"version"`
	Channel string `json:"channel"`
}

func (f *Feature) candidates(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireAdmin(w, r)
	if !ok {
		return
	}
	releases, err := f.fetchReleases(r.Context())
	if err != nil {
		f.recordAudit(r, user, "release_check", audit.OutcomeFailure, err.Error(), nil)
		writeProblem(w, http.StatusBadGateway, "Release check failed", err.Error())
		return
	}

	var stable *candidate
	var unstable *candidate
	for _, release := range releases {
		if release.Draft {
			continue
		}
		next := release.toCandidate()
		if release.Prerelease {
			next.Channel = "unstable"
			if unstable == nil {
				unstable = &next
			}
			continue
		}
		next.Channel = "stable"
		if stable == nil {
			stable = &next
		}
	}

	result := map[string]*candidate{
		"stable":   stable,
		"unstable": unstable,
	}
	writeJSON(w, http.StatusOK, result)
	f.recordAudit(r, user, "release_check", audit.OutcomeSuccess, "", map[string]any{
		"repository": f.cfg.GitHubRepository,
	})
}

func (f *Feature) status(w http.ResponseWriter, r *http.Request) {
	if _, ok := f.requireAdmin(w, r); !ok {
		return
	}
	if f.cfg.UpdaterURL == "" {
		writeJSON(w, http.StatusOK, map[string]any{"state": "disabled"})
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, strings.TrimRight(f.cfg.UpdaterURL, "/")+"/status", nil)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Updater request failed", err.Error())
		return
	}
	f.authorizeUpdater(req)
	resp, err := f.httpClient.Do(req)
	if err != nil {
		writeProblem(w, http.StatusBadGateway, "Updater unavailable", err.Error())
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json;charset=utf8")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (f *Feature) startJob(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireAdmin(w, r)
	if !ok {
		return
	}
	if f.cfg.UpdaterURL == "" {
		writeProblem(w, http.StatusServiceUnavailable, "Updater disabled", "HOUSEHOLD_UPDATES_UPDATER_URL is not configured")
		return
	}
	var reqBody startJobRequest
	if !decodeJSON(w, r, &reqBody) {
		return
	}
	if strings.TrimSpace(reqBody.Version) == "" {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", "Version is required")
		return
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Updater request failed", err.Error())
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, strings.TrimRight(f.cfg.UpdaterURL, "/")+"/update", bytes.NewReader(body))
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Updater request failed", err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	f.authorizeUpdater(req)
	resp, err := f.httpClient.Do(req)
	if err != nil {
		f.recordAudit(r, user, "update_start", audit.OutcomeFailure, err.Error(), map[string]any{"version": reqBody.Version, "channel": reqBody.Channel})
		writeProblem(w, http.StatusBadGateway, "Updater unavailable", err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		f.recordAudit(r, user, "update_start", audit.OutcomeFailure, fmt.Sprintf("updater HTTP %d", resp.StatusCode), map[string]any{"version": reqBody.Version, "channel": reqBody.Channel})
	} else {
		f.recordAudit(r, user, "update_start", audit.OutcomeSuccess, "", map[string]any{"version": reqBody.Version, "channel": reqBody.Channel})
	}
	w.Header().Set("Content-Type", "application/json;charset=utf8")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (f *Feature) fetchReleases(ctx context.Context) ([]githubRelease, error) {
	repo := strings.Trim(f.cfg.GitHubRepository, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/repos/"+repo+"/releases?per_page=20", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "household-api")
	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("GitHub returned HTTP %d", resp.StatusCode)
	}
	var releases []githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}
	return releases, nil
}

func (release githubRelease) toCandidate() candidate {
	result := candidate{
		Version:      release.TagName,
		Name:         release.Name,
		Prerelease:   release.Prerelease,
		PublishedAt:  release.PublishedAt,
		HTMLURL:      release.HTMLURL,
		ReleaseNotes: release.Body,
	}
	for _, asset := range release.Assets {
		if asset.Name == "household-release.json" {
			result.ManifestURL = asset.BrowserDownloadURL
			break
		}
	}
	return result
}

func (f *Feature) authorizeUpdater(req *http.Request) {
	if f.cfg.UpdaterToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.cfg.UpdaterToken)
	}
}

func (f *Feature) recordAudit(r *http.Request, user *identity.User, action string, outcome string, errorCode string, metadata map[string]any) {
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
		Module:      "updates",
		TargetType:  "release",
		Outcome:     outcome,
		IP:          r.RemoteAddr,
		UserAgent:   r.UserAgent(),
		Metadata:    rawMetadata,
		ErrorCode:   errorCode,
	})
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

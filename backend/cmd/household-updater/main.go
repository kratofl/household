package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type config struct {
	ListenAddr  string
	SharedToken string
	StackDir    string
	EnvFile     string
	ComposeFile string
	BackupDir   string
}

type updateRequest struct {
	Version string `json:"version"`
	Channel string `json:"channel"`
}

type status struct {
	State     string    `json:"state"`
	Version   string    `json:"version,omitempty"`
	Channel   string    `json:"channel,omitempty"`
	Message   string    `json:"message,omitempty"`
	StartedAt time.Time `json:"startedAt,omitempty"`
	EndedAt   time.Time `json:"endedAt,omitempty"`
}

type server struct {
	cfg    config
	mu     sync.Mutex
	status status
}

func main() {
	cfg := config{
		ListenAddr:  getenv("HOUSEHOLD_UPDATER_LISTEN_ADDR", ":8091"),
		SharedToken: os.Getenv("HOUSEHOLD_UPDATER_TOKEN"),
		StackDir:    getenv("HOUSEHOLD_UPDATER_STACK_DIR", "/stack"),
		EnvFile:     getenv("HOUSEHOLD_UPDATER_ENV_FILE", "/stack/.env"),
		ComposeFile: getenv("HOUSEHOLD_UPDATER_COMPOSE_FILE", "/stack/docker-compose.yml"),
		BackupDir:   getenv("HOUSEHOLD_UPDATER_BACKUP_DIR", "/stack/backups"),
	}
	s := &server{
		cfg: cfg,
		status: status{
			State: "idle",
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/status", s.withAuth(s.handleStatus))
	mux.HandleFunc("/update", s.withAuth(s.handleUpdate))
	log.Printf("starting updater on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, mux); err != nil {
		log.Fatal(err)
	}
}

func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	writeJSON(w, http.StatusOK, s.status)
}

func (s *server) handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	req.Version = strings.TrimSpace(req.Version)
	if req.Version == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "version is required"})
		return
	}

	s.mu.Lock()
	if s.status.State == "running" {
		s.mu.Unlock()
		writeJSON(w, http.StatusConflict, map[string]string{"error": "update already running"})
		return
	}
	s.status = status{State: "running", Version: req.Version, Channel: req.Channel, StartedAt: time.Now().UTC(), Message: "starting"}
	s.mu.Unlock()

	go s.runUpdate(req)
	writeJSON(w, http.StatusAccepted, s.currentStatus())
}

func (s *server) runUpdate(req updateRequest) {
	err := s.updateEnvVersion(req.Version)
	if err == nil {
		err = os.MkdirAll(s.cfg.BackupDir, 0o750)
	}
	if err == nil {
		err = s.runStep("creating backup", "docker", "compose", "--env-file", s.cfg.EnvFile, "-f", s.cfg.ComposeFile, "exec", "-T", "household-db", "sh", "-c", `pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc`, filepath.Join(s.cfg.BackupDir, backupName(req.Version)))
	}
	if err == nil {
		err = s.runStep("pulling images", "docker", "compose", "--env-file", s.cfg.EnvFile, "-f", s.cfg.ComposeFile, "pull", "household-api", "household-web")
	}
	if err == nil {
		err = s.runStep("restarting stack", "docker", "compose", "--env-file", s.cfg.EnvFile, "-f", s.cfg.ComposeFile, "up", "-d", "household-api", "household-web")
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.EndedAt = time.Now().UTC()
	if err != nil {
		s.status.State = "failed"
		s.status.Message = err.Error()
		return
	}
	s.status.State = "succeeded"
	s.status.Message = "update applied"
}

func (s *server) runStep(message string, name string, args ...string) error {
	s.setMessage(message)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	var stdoutFile *os.File
	var err error
	if len(args) > 0 && strings.HasPrefix(args[len(args)-1], s.cfg.BackupDir) {
		stdoutFile, err = os.Create(args[len(args)-1])
		if err != nil {
			return err
		}
		defer stdoutFile.Close()
		args = args[:len(args)-1]
	}
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = s.cfg.StackDir
	var stderr strings.Builder
	if stdoutFile != nil {
		cmd.Stdout = stdoutFile
		cmd.Stderr = &stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("%s failed: %w: %s", message, err, strings.TrimSpace(stderr.String()))
		}
		return nil
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s failed: %w: %s", message, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func (s *server) updateEnvVersion(version string) error {
	s.setMessage("updating environment")
	data, err := os.ReadFile(s.cfg.EnvFile)
	if err != nil {
		return err
	}
	lines := strings.Split(string(data), "\n")
	replaced := false
	for i, line := range lines {
		if strings.HasPrefix(line, "HOUSEHOLD_VERSION=") {
			lines[i] = "HOUSEHOLD_VERSION=" + version
			replaced = true
			break
		}
	}
	if !replaced {
		lines = append(lines, "HOUSEHOLD_VERSION="+version)
	}
	return os.WriteFile(s.cfg.EnvFile, []byte(strings.Join(lines, "\n")), 0o600)
}

func (s *server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.SharedToken == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "updater token is not configured"})
			return
		}
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token != s.cfg.SharedToken {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

func (s *server) setMessage(message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.Message = message
}

func (s *server) currentStatus() status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

func backupName(version string) string {
	clean := strings.NewReplacer("/", "-", ":", "-", "@", "-").Replace(version)
	return fmt.Sprintf("household-before-%s-%s.dump", clean, time.Now().UTC().Format("20060102150405"))
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json;charset=utf8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func getenv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

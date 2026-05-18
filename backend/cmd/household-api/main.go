package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"household/backend/internal/features/auditlog"
	"household/backend/internal/features/budget"
	"household/backend/internal/features/identity"
	"household/backend/internal/features/updates"
	"household/backend/internal/platform/audit"
	"household/backend/internal/platform/config"
	"household/backend/internal/platform/database"
	platformhttp "household/backend/internal/platform/http"
	"household/backend/internal/platform/logging"
	"household/backend/internal/platform/migrations"
	"household/backend/internal/platform/validation"
)

func main() {
	c, err := config.New("HOUSEHOLD")
	if err != nil {
		log.Fatalf("failed loading env: %v", err)
	}

	l, err := logging.New(c, "household-api")
	if err != nil {
		log.Fatalf("failed to load logger: %v", err)
	}
	defer l.Close()

	db, err := database.OpenPostgres(c)
	if err != nil {
		l.Fatal().Err(err).Msg("DB connection start failure")
	}
	sqlDB, err := db.DB()
	if err != nil {
		l.Fatal().Err(err).Msg("Failed to get sql.DB from gorm.DB")
	}
	defer sqlDB.Close()
	if err := migrations.RunPostgres(sqlDB, c.DB.DBName, []migrations.FeatureMigration{
		{Name: "identity", SourceURL: identity.MigrationSourceURL, MigrationsTable: identity.MigrationTableName},
		{Name: "audit", SourceURL: audit.MigrationSourceURL, MigrationsTable: audit.MigrationTableName},
		{Name: "budget", SourceURL: budget.MigrationSourceURL, MigrationsTable: budget.MigrationTableName},
	}); err != nil {
		l.Fatal().Err(err).Msg("Failed to migrate database")
	}
	if err := identity.SeedDemoUser(db, c.Seed); err != nil {
		l.Fatal().Err(err).Msg("Failed to seed demo user")
	}

	auditRepo := audit.NewRepository(db)
	r := platformhttp.NewRouter(c, l, validation.New(),
		identity.NewFeature(db, auditRepo),
		budget.NewFeature(db),
		auditlog.NewFeature(db),
		updates.NewFeature(db, c.Updates, auditRepo),
	)

	s := &http.Server{
		Addr:         fmt.Sprintf(":%d", c.Server.Port),
		Handler:      r,
		ReadTimeout:  c.Server.TimeoutRead,
		WriteTimeout: c.Server.TimeoutWrite,
		IdleTimeout:  c.Server.TimeoutIdle,
	}

	closed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		l.Info().Msgf("Shutting down server %v", s.Addr)

		ctx, cancel := context.WithTimeout(context.Background(), c.Server.TimeoutIdle)
		defer cancel()

		if err := s.Shutdown(ctx); err != nil {
			l.Error().Err(err).Msg("Server shutdown failure")
		}

		close(closed)
	}()

	l.Info().Msgf("Starting server %v", s.Addr)
	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		l.Fatal().Err(err).Msg("Server startup failure")
	}

	<-closed
	l.Info().Msg("Server shutdown successfully")
}

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"household/identity/internal/router"
	"household/shared/pkg/config"
	"household/shared/pkg/database"
	"household/shared/pkg/logging"
	"household/shared/pkg/validator"

	migratePostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func main() {
	c, err := config.New("IDENTITY")
	if err != nil {
		log.Fatalf("failed loading env: %v", err)
		return
	}
	l, err := logging.New(c)
	if err != nil {
		log.Fatalf("failed to load logger: %v", err)
		return
	}
	defer l.Close()

	v := validator.New()
	var logLevel gormlogger.LogLevel
	if c.DB.Debug {
		logLevel = gormlogger.Info
	} else {
		logLevel = gormlogger.Error
	}

	dbString := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable", c.DB.Host, c.DB.Username, c.DB.Password, c.DB.DBName, strconv.Itoa(c.DB.Port))
	db, err := gorm.Open(postgres.Open(dbString), &gorm.Config{Logger: gormlogger.Default.LogMode(logLevel)})
	if err != nil {
		l.Fatal().Err(err).Msg("DB connection start failure")
		return
	}
	sqlDB, err := db.DB()
	if err != nil {
		l.Fatal().Err(err).Msg("Failed to get sql.DB from gorm.DB")
		return
	}
	driver, err := migratePostgres.WithInstance(sqlDB, &migratePostgres.Config{})
	if err != nil {
		l.Fatal().Err(err).Msg("Failed to create migration datbase driver")
		return
	}
	migrateRrr := database.Migrate("file://./database/migrations", c.DB.DBName, driver)
	if migrateRrr != nil {
		l.Fatal().Err(migrateRrr).Msg("Failed to migrate database")
		return
	}

	r := router.New(c, v, db, l)

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

		sqlDB, err := db.DB()
		if err == nil {
			if err = sqlDB.Close(); err != nil {
				l.Error().Err(err).Msg("DB connection closing failure")
			}
		}

		close(closed)
	}()

	l.Info().Msgf("Starting server %v", s.Addr)
	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		l.Fatal().Err(err).Msg("Server startup failure")
	}

	<-closed
	l.Info().Msgf("Server shutdown successfully")
}

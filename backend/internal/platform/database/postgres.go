package database

import (
	"fmt"
	"strconv"

	"household/backend/internal/platform/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func OpenPostgres(c *config.Config) (*gorm.DB, error) {
	logLevel := gormlogger.Error
	if c.DB.Debug {
		logLevel = gormlogger.Info
	}

	db, err := gorm.Open(postgres.Open(PostgresDSN(c)), &gorm.Config{
		Logger: gormlogger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	return db, nil
}

func PostgresDSN(c *config.Config) string {
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable", c.DB.Host, c.DB.Username, c.DB.Password, c.DB.DBName, strconv.Itoa(c.DB.Port))
}

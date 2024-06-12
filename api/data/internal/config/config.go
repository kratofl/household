package config

import "os"

type DatabaseConfig struct {
	host     string
	port     string
	username string
	password string
	database string
}

func NewDbConfig() DatabaseConfig {
	return DatabaseConfig{
		host:     os.Getenv("DB_HOST"),
		port:     os.Getenv("DB_PORT"),
		username: os.Getenv("DB_USERNAME"),
		password: os.Getenv("DB_PASSWORD"),
		database: os.Getenv("DB_DATABASE"),
	}
}

func (c *DatabaseConfig) GetHost() string {
	return c.host
}

func (c *DatabaseConfig) GetPort() string {
	return c.port
}

func (c *DatabaseConfig) GetUsername() string {
	return c.username
}

func (c *DatabaseConfig) GetPassword() string {
	return c.password
}

func (c *DatabaseConfig) GetDatabase() string {
	return c.database
}

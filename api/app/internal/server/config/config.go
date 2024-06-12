package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

var (
	Version string
)

type ServerConfig struct {
	App    ServerConfigApp
	Server ServerConfigServer
}
type ServerConfigApp struct {
	Environment Environment
}
type ServerConfigServer struct {
	Host string
	Port int
}

type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvTest        Environment = "test"
	EnvProduction  Environment = "production"
)

func NewServerConfig() *ServerConfig {
	serverPort, _ := strconv.Atoi(os.Getenv("SERVER_PORT"))
	return &ServerConfig{
		App: ServerConfigApp{
			Environment: Environment(os.Getenv("APP_ENV")),
		},
		Server: ServerConfigServer{
			Host: os.Getenv("SERVER_HOST"),
			Port: serverPort,
		},
	}
}

func LoadEnv() error {
	err := godotenv.Load()
	if err != nil {
		return fmt.Errorf("loading default env file: %w", err)
	}

	envLoadErr := godotenv.Load(getEnvFileName())
	if envLoadErr != nil {
		return fmt.Errorf("loading actual env file: %w", err)
	}
	return nil
}
func getEnvFileName() string {
	env := os.Getenv("APP_ENV")
	fmt.Printf("ENV: %s\n", env)
	return ".env." + env
}

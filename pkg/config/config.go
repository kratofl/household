package config

import (
	"fmt"
	"os"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	Server ConfigServer `envPrefix:"SERVER_"`
	DB     ConfigDb     `envPrefix:"DB_"`
}

type ConfigServer struct {
	Port         int           `env:"PORT,required"`
	TimeoutRead  time.Duration `env:"TIMEOUT_READ,required"`
	TimeoutWrite time.Duration `env:"TIMEOUT_WRITE,required"`
	TimeoutIdle  time.Duration `env:"TIMEOUT_IDLE,required"`
	Debug        bool          `env:"DEBUG"`
}

type ConfigDb struct {
	Host     string `env:"HOST,required"`
	Port     int    `env:"PORT,required"`
	Username string `env:"USER,required"`
	Password string `env:"PASSWORD,required"`
	DBName   string `env:"DATABASE,required"`
	Debug    bool   `env:"DEBUG"`
}

func New() (*Config, error) {
	err := godotenv.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load default env: %v", err)
	}

	envFileName := getEnvFileName()
	envLoadErr := godotenv.Load(envFileName)
	if envLoadErr != nil {
		return nil, fmt.Errorf("failed to load '%s' env: %v", envFileName, envLoadErr)
	}

	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

func getEnvFileName() string {
	env := os.Getenv("ENV")
	fmt.Printf("ENV: %s\n", env)
	return ".env." + env
}

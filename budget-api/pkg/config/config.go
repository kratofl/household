package config

import (
	"time"

	"github.com/caarlos0/env/v11"
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
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

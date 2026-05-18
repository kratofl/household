package config

import (
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Server  ConfigServer  `envPrefix:"API_SERVER_"`
	DB      ConfigDB      `envPrefix:"API_DB_"`
	Seed    ConfigSeed    `envPrefix:"SEED_"`
	Log     ConfigLog     `envPrefix:"LOG_"`
	Updates ConfigUpdates `envPrefix:"UPDATES_"`
}

type ConfigServer struct {
	Port         int           `env:"PORT,required"`
	TimeoutRead  time.Duration `env:"TIMEOUT_READ,required"`
	TimeoutWrite time.Duration `env:"TIMEOUT_WRITE,required"`
	TimeoutIdle  time.Duration `env:"TIMEOUT_IDLE,required"`
	Debug        bool          `env:"DEBUG"`
}

type ConfigDB struct {
	Host     string `env:"HOST,required"`
	Port     int    `env:"PORT,required"`
	Username string `env:"USER,required"`
	Password string `env:"PASSWORD,required"`
	DBName   string `env:"DATABASE,required"`
	Debug    bool   `env:"DEBUG"`
}

type ConfigSeed struct {
	DemoUser         bool   `env:"DEMO_USER"`
	DemoUserName     string `env:"DEMO_USER_NAME"`
	DemoUserEmail    string `env:"DEMO_USER_EMAIL"`
	DemoUserPassword string `env:"DEMO_USER_PASSWORD"`
}

type ConfigLog struct {
	Level       string `env:"LEVEL"`
	Environment string `env:"ENVIRONMENT"`
	Version     string `env:"VERSION"`
	FileEnabled bool   `env:"FILE_ENABLED"`
}

type ConfigUpdates struct {
	GitHubRepository string        `env:"GITHUB_REPOSITORY" envDefault:"kratofl/household"`
	UpdaterURL       string        `env:"UPDATER_URL"`
	UpdaterToken     string        `env:"UPDATER_TOKEN"`
	Timeout          time.Duration `env:"TIMEOUT" envDefault:"15s"`
}

func New(prefix string) (*Config, error) {
	var c Config
	if err := env.ParseWithOptions(&c, env.Options{
		Prefix: prefix + "_",
	}); err != nil {
		return nil, err
	}

	return &c, nil
}

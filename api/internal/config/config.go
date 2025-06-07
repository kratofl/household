package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port int
}

func LoadConfig() Config {
	port, _ := strconv.Atoi(os.Getenv("PORT"))

	return Config{
		Port: port,
	}
}

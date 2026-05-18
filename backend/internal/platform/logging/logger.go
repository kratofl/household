package logging

import (
	"io"
	"os"
	"path"
	"strings"
	"time"

	"household/backend/internal/platform/config"

	"github.com/rs/zerolog"
)

type AppLogger struct {
	zerolog.Logger
	file *os.File
}

func New(config *config.Config, serviceName string) (*AppLogger, error) {
	logLevel, err := logLevel(config)
	if err != nil {
		return nil, err
	}
	zerolog.SetGlobalLevel(logLevel)

	writers := []io.Writer{os.Stdout}
	var file *os.File

	if config.Log.FileEnabled {
		t := time.Now()
		logFolderPath := path.Join("logs", t.Format("2006"), t.Format("01"))
		if err := os.MkdirAll(logFolderPath, os.ModePerm); err != nil {
			return nil, err
		}
		logFilePath := path.Join(logFolderPath, t.Format("02")+".log")

		file, err = os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
		if err != nil {
			return nil, err
		}
		writers = append(writers, file)
	}

	logger := zerolog.New(zerolog.MultiLevelWriter(writers...)).
		With().
		Timestamp().
		Caller().
		Str("service", serviceName).
		Str("environment", environment(config)).
		Str("version", version(config)).
		Logger()

	return &AppLogger{Logger: logger, file: file}, nil
}

func (l *AppLogger) Close() error {
	if l.file == nil {
		return nil
	}
	return l.file.Close()
}

func logLevel(config *config.Config) (zerolog.Level, error) {
	if config.Log.Level != "" {
		return zerolog.ParseLevel(strings.ToLower(config.Log.Level))
	}
	if config.Server.Debug {
		return zerolog.TraceLevel, nil
	}
	return zerolog.InfoLevel, nil
}

func environment(config *config.Config) string {
	if config.Log.Environment != "" {
		return config.Log.Environment
	}
	return "dev"
}

func version(config *config.Config) string {
	if config.Log.Version != "" {
		return config.Log.Version
	}
	return "dev"
}

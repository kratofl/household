package logging

import (
	"os"
	"path"
	"time"

	"github.com/kratofl/household/budget/pkg/config"
	"github.com/rs/zerolog"
)

const KeyReqID = "request_id"

type AppLogger struct {
	zerolog.Logger
	file *os.File
}

func New(config *config.Config) (*AppLogger, error) {
	logLevel := zerolog.InfoLevel
	if config.Server.Debug {
		logLevel = zerolog.TraceLevel
	}
	zerolog.SetGlobalLevel(logLevel)

	t := time.Now()
	logFolderPath := path.Join("logs", t.Format("2006"), t.Format("01"))
	os.MkdirAll(logFolderPath, os.ModePerm)
	logFilePath := path.Join(logFolderPath, t.Format("02")+".log")

	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return nil, err
	}

	multi := zerolog.MultiLevelWriter(os.Stdout, file)
	logger := zerolog.New(multi).With().Timestamp().Caller().Logger()

	return &AppLogger{Logger: logger, file: file}, nil
}

func (l *AppLogger) Close() error {
	return l.file.Close()
}

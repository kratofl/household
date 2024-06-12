package logger

import (
	"fmt"
	"log/slog"
	"os"
	"path"
	"time"
)

var (
	logger *slog.Logger
)

func InitializeLogger() error {
	t := time.Now()

	logFileName := os.Getenv("LOG_FILE")

	logFolderPath := path.Join("logs", t.Format("2006"), t.Format("01"))
	os.MkdirAll(logFolderPath, os.ModePerm)

	logFilePath := path.Join(logFolderPath, t.Format("02")+"-"+logFileName)

	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("could not open log file: %w", err)
	}

	handlerOpts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}
	logger = slog.New(slog.NewJSONHandler(file, handlerOpts))
	slog.SetDefault(logger)

	logger.Info("Logger initialized")
	return nil
}

func Debug(msg string, args ...any) {
	logger.Debug(msg, args...)
}

func Info(msg string, args ...any) {
	logger.Info(msg, args...)
}

func Warn(msg string, args ...any) {
	logger.Warn(msg, args...)
}
func WarnWithErr(msg string, err error) {
	logger.Warn(msg, slog.Any("err", err))
}

func Error(msg string, args ...any) {
	logger.Error(msg, args...)
}
func ErrorWithErr(msg string, err error) {
	logger.Error(msg, slog.Any("err", err))
}

func Attr(key string, value any) slog.Attr {
	return slog.Any(key, value)
}

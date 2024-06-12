package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/kratofl/budget/app/internal/http/handlers"
	"github.com/kratofl/budget/app/internal/server/config"
	"github.com/kratofl/budget/core/pkg/logger"
)

type Server struct {
	Router *mux.Router
	Cfg    *config.ServerConfig
}

func NewServer() (*Server, error) {
	err := config.LoadEnv()
	if err != nil {
		return nil, fmt.Errorf("load env: %w", err)
	}

	return &Server{
		Cfg:    config.NewServerConfig(),
		Router: newRouter(),
	}, nil
}

func StartServer(server *Server) error {
	err := logger.InitializeLogger()
	if err != nil {
		return fmt.Errorf("initialize logger: %w", err)
	}

	addr := server.Cfg.Server.Host + ":" + strconv.Itoa(server.Cfg.Server.Port)
	fmt.Printf("Running: %s\n", addr)
	return http.ListenAndServe(addr, server.Router)
}

func newRouter() *mux.Router {
	router := mux.NewRouter()
	//router.Use(middleware.AuthMiddleware)
	router.NotFoundHandler = http.HandlerFunc(handlers.NotFoundHandler)
	router.MethodNotAllowedHandler = http.HandlerFunc(handlers.MethodNotAllowedHandler)
	return router
}

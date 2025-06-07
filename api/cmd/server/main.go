package main

import (
	"log"
	"net/http"

	router "github.com/kratofl/budget-api/internal"
	"github.com/kratofl/budget-api/internal/config"
)

func main() {
	cfg := config.LoadConfig()

	r := router.New()

	log.Println("Server läuft auf Port", cfg.Port)
	http.ListenAndServe(":"+cfg.Port, r)
}

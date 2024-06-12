package main

import (
	"github.com/kratofl/budget/app/internal/server"
	"github.com/kratofl/budget/app/internal/server/config"
	"github.com/kratofl/budget/data/pkg/database"
	"github.com/kratofl/budget/data/pkg/repositories"
	"go.uber.org/fx"
)

func main() {
	fx.New(
		/* Server */
		fx.Provide(server.NewServer),
		fx.Provide(config.NewServerConfig),

		/* DB */
		fx.Provide(database.NewDatabase),
		/* Repos */
		fx.Provide(repositories.NewCompanyRepository),
		/* Services */
		/* Handlers */

		fx.Invoke(server.SetupRoutes, server.StartServer),
	).Run()
}

package database

import (
	"database/sql"
	"fmt"

	"github.com/kratofl/budget/data/internal/config"
)

type Database struct {
	database *sql.DB
}

func NewDatabase() (*Database, error) {
	config := config.NewDbConfig()

	dbConn, err := connectToDb(config)
	if err != nil {
		return nil, err
	}

	return &Database{
		database: dbConn,
	}, nil
}

func (db *Database) GetConn() *sql.DB {
	return db.database
}

func connectToDb(config config.DatabaseConfig) (*sql.DB, error) {
	connectionString := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", config.GetUsername(), config.GetPassword(), config.GetHost(), config.GetPort(), config.GetDatabase())
	return sql.Open("mysql", connectionString)
}

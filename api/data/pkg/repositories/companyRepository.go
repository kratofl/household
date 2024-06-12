package repositories

import "github.com/kratofl/budget/data/pkg/database"

type CompanyRepository struct {
	db *database.Database
}

func NewCompanyRepository(db *database.Database) *CompanyRepository {
	return &CompanyRepository{
		db: db,
	}
}

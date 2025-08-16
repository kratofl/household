module github.com/kratofl/household/budget

go 1.25.0

require (
	github.com/go-chi/chi/v5 v5.2.2
	github.com/google/uuid v1.6.0
	github.com/rs/zerolog v1.34.0
	gorm.io/driver/mysql v1.6.0
	gorm.io/gorm v1.30.1
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/caarlos0/env/v11 v11.3.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.9 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-sql-driver/mysql v1.9.3 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	golang.org/x/crypto v0.41.0 // indirect
	golang.org/x/net v0.43.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
)

require (
	github.com/go-playground/validator/v10 v10.27.0
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	golang.org/x/text v0.28.0 // indirect
)

require github.com/kratofl/household/shared v0.0.0

replace github.com/kratofl/household/shared => ./../shared

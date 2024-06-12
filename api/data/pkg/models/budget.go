package models

type Budget struct {
	Id     string
	Amount int64

	AccountId  string
	CategoryId string
}

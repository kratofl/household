FROM golang:1.24.4 AS base
WORKDIR /budget-api

# Dev-Image with Air - Live reload
FROM base AS local
COPY go/app/parsedata-xml-fp.go .
COPY go.mod .
COPY go.sum .
COPY . .
RUN go mod tidy
COPY . .

# Test-Image
FROM base AS test
COPY . .
RUN go build -o main ./cmd/api
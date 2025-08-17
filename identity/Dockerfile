# ---------- Build Stage ----------
FROM golang:1.25.0-alpine AS builder
WORKDIR /src

COPY ../shared ./shared
COPY ../identity ./identity
COPY ../budget/go.mod ./budget/go.mod
COPY ./go.work .
RUN go mod download
RUN go build -o /src/app-binary ./identity/cmd/api/main.go

# ---------- Development Stage ----------
FROM golang:1.25.0-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY --from=builder /src .
WORKDIR /app/identity
ENTRYPOINT ["air", "-c", ".air.toml"]

# ---------- Production/Test Stage ----------
FROM alpine:3.22 AS release
WORKDIR /app
COPY --from=builder /src/app-binary .
ENTRYPOINT ["./app-binary"]


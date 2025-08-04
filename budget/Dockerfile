# ---------- Build Stage ----------
FROM golang:1.24.5-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o app-binary ./cmd/api/main.go

# ---------- Development Stage ----------
FROM golang:1.24.5-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY --from=builder /src .
COPY .air.toml ./
ENTRYPOINT ["air", "-c", ".air.toml"]

# ---------- Production/Test Stage ----------
FROM alpine:3.22 AS release
WORKDIR /app
COPY --from=builder /app/app-binary .
ENTRYPOINT ["./app-binary"]

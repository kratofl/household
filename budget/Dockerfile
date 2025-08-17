# ---------- Build Stage ----------
FROM golang:1.25.0-alpine AS builder
WORKDIR /src

COPY ../shared ./shared
COPY ../budget ./budget
WORKDIR /src/budget
RUN go mod download
RUN go build -o /src/app-binary ./cmd/api/main.go

# ---------- Development Stage ----------
FROM golang:1.25.0-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY --from=builder /src .
# COPY budget/.air.toml /app/budget/:.air.toml
WORKDIR /app/budget
ENTRYPOINT ["air", "-c", ".air.toml"]

# ---------- Production/Test Stage ----------
FROM alpine:3.22 AS release
WORKDIR /app
COPY --from=builder /src/app-binary .
ENTRYPOINT ["./app-binary"]


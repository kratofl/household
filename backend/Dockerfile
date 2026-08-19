FROM golang:1.26.5-alpine3.23 AS builder
WORKDIR /app

COPY go.work go.work.sum ./
COPY backend ./backend
WORKDIR /app/backend
RUN go build -o /app/household-api ./cmd/household-api

FROM golang:1.26.5-alpine3.23 AS dev
WORKDIR /app
RUN apk add --no-cache git && go install github.com/air-verse/air@latest
COPY --from=builder /app .
WORKDIR /app/backend
ENTRYPOINT ["air", "-c", ".air.toml"]

FROM alpine:3.23 AS release
WORKDIR /app
RUN apk add --no-cache ca-certificates wget && addgroup -S household && adduser -S household -G household
COPY --from=builder /app/household-api .
COPY --from=builder /app/backend/internal ./internal
USER household
ENTRYPOINT ["./household-api"]

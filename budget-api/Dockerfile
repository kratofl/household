# Build stage
FROM golang:1.24.4-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /air ./cmd/api/main.go

# Final stage
FROM golang:1.24.4-alpine
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY --from=builder /app /app
COPY --from=builder /air /air
COPY .air.toml ./
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

FROM golang:1.25.0-alpine AS builder
WORKDIR /src

COPY ../shared ./shared
COPY ../identity ./identity
COPY ../budget/go.mod ./budget/go.mod
COPY ./go.work .
RUN go mod download
RUN go build -o /src/app-binary ./identity/cmd/api/main.go

FROM alpine:3.22 AS release
WORKDIR /app
COPY --from=builder /src/app-binary .
ENTRYPOINT ["./app-binary"]


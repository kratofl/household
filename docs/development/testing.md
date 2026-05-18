# Testing and checks

Run all standard checks from the repository root:

```bash
make check
```

This runs backend tests, backend builds, web lint, web build, and Compose configuration validation.

## Backend

```bash
make backend-test
make backend-build
```

Equivalent direct commands:

```bash
cd backend
go test ./...
go build ./cmd/household-api ./cmd/household-updater
```

Do not run `go test ./...` from the repository root. The root is a Go workspace, while the backend module lives in `backend/`.

## Web

```bash
make web-lint
make web-build
```

Equivalent direct commands:

```bash
cd clients/web
npm run lint
npm run build
```

Run `npm ci` first if dependencies are missing.

## Compose

```bash
make compose-config
```

This validates:

- Production image-based Compose.
- Production source-build override Compose.
- Development dependency Compose.

The check uses `deployments/.env.example` so it is safe for CI and clean clones.

## Before opening a PR

- Run `make check`.
- Add or update focused tests for changed behavior.
- Update docs when install, config, API, or contributor workflows change.

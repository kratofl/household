# Testing and checks

Run all standard checks from the repository root:

```bash
make check
```

This runs backend migration/API tests, backend builds, web lint/build, Compose validation,
workflow linting, and release-bundle tests.

## Backend

```bash
make backend-test
make backend-build
```

Equivalent commands:

```bash
cd backend
dotnet test Household.slnx
dotnet build Household.slnx
```

The integration suite launches an isolated PostgreSQL 18 container through the Docker CLI. It applies representative Go-era schema fixtures, starts the production API and EF Core migrations, and verifies public authenticated HTTP behavior and data preservation. Docker must therefore be running for backend tests.

The backend build also enforces the code style rules in `backend/.editorconfig` (no `var`, `this.` qualification, `_camelCase` private fields) as errors. `dotnet format style Household.slnx` fixes most of them; rerun it until it reports no changes, since some fixes only become visible after earlier ones land.

## Web and Compose

```bash
make web-lint
make web-build
make compose-config
```

Run `npm ci` in `clients/web` first when dependencies are missing.

## Workflow changes

Run `make workflow-check` or `.\make.ps1 workflow-check` before changing CI or
release packaging. This requires Docker, Node.js, and `tar`; it downloads the pinned
actionlint image on first use. Bundle tests use temporary directories and parse
the extracted Compose files without starting services or reading your local `.env`.

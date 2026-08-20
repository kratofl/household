# Testing and checks

Run all standard checks from the repository root:

```bash
make check
```

This runs backend migration/API tests, backend builds, web lint/build, and Compose validation.

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

## Web and Compose

```bash
make web-lint
make web-build
make compose-config
```

Run `npm ci` in `clients/web` first when dependencies are missing.

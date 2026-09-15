# Household

[![CI](https://github.com/kratofl/household/actions/workflows/ci.yml/badge.svg)](https://github.com/kratofl/household/actions/workflows/ci.yml)

Household is a local-network-first, self-hosted household management app. It is being built as a small home-server application for identity/admin, budget tracking, and future household workflows such as shopping lists, recipes, meal planning, calendar, and waste schedules.

The project is early-stage. The install, identity foundation, module toggles, update checks, and backend architecture are the current focus; budget functionality is still under active development.

## Why run it?

- **Home-server first:** designed for trusted local networks, NAS boxes, small VMs, and homelabs.
- **One Compose stack:** web UI, .NET modular-monolith API, updater sidecar, and PostgreSQL.
- **Public-image installs:** normal installs use published container images, not local source builds.
- **Admin-gated identity:** users can register, remain pending, and be approved by an admin.
- **Modular foundation:** one backend process with feature-owned packages and Postgres schemas.
- **Operational basics:** backups, release-channel checks, optional observability, and documented configuration.

## Current status

| Area | Status |
| --- | --- |
| Install and operations | Docker Compose stack, env template, backup/restore docs, updater sidecar. |
| Identity | Login, refresh/logout, pending users, admin user management foundation, password change. |
| Modules | Enabled/active module toggles drive navigation visibility. |
| Budget | Schema and route scaffold; domain behavior is planned/in progress. |
| Web UI | Next.js App Router UI with local-network backend proxy. |
| Observability | Optional Grafana, Loki, and Grafana Alloy profile. |

Screenshots are not ready yet. The current public-readiness work is prioritizing reliable install and contributor workflows first.

## Install on a home server

Requirements: Docker Engine with the Docker Compose plugin and outbound access to GitHub Container Registry.

```bash
mkdir -p ~/household
cd ~/household
curl -LO https://github.com/kratofl/household/releases/latest/download/household-release-bundle.tar.gz
tar -xzf household-release-bundle.tar.gz
cp .env.example .env
```

Edit `.env`, replace all `change-me` values, set `HOUSEHOLD_SEED_DEMO_USER=true` for first boot, then start:

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
```

Open `http://<server-ip>:3000`. After the first admin account is usable, set `HOUSEHOLD_SEED_DEMO_USER=false` and restart.

Full guide: [docs/install/home-server.md](docs/install/home-server.md)

## Develop locally

Install Git and Docker Desktop with Linux containers on Windows/macOS, or Docker
Engine on Linux. Docker Compose 2.32+ is required for source synchronization.
On macOS/Linux use Make; on Windows use PowerShell and Git for Windows.
The images support AMD64 and ARM64, including Apple Silicon.

Clone the repository, then start from its root:

| Action | macOS / Linux | Windows PowerShell |
| --- | --- | --- |
| Start and watch source changes | `make dev` | `.\make.ps1 dev` |
| Show URL and status | `make dev-info` | `.\make.ps1 dev-info` |
| Follow logs | `make dev-logs` | `.\make.ps1 dev-logs` |
| Stop, retain data | `make dev-down` | `.\make.ps1 dev-down` |
| Reset development data, with confirmation | `make reset-dev-db` | `.\make.ps1 reset-dev-db` |

API, Next.js, and PostgreSQL run in Docker. The first start builds the development
images and seeds `admin` / `admin`. Open the localhost URL printed by the command.
Keep the terminal open for automatic source synchronization and hot reload.
Ctrl+C ends synchronization; services keep running until `dev-down`.
Use `dev-logs` in another terminal to follow application logs.

**Each worktree gets its own environment automatically.** Its directory path
determines the Compose project name, isolating containers, networks, and database
volumes. Docker allocates an available localhost web port. API and database ports
stay internal. Data persists across stops and branch changes within that worktree;
new worktrees start with independent development data. URLs may change after
container recreation; `dev-info` prints the current one.

No local .NET/Node installation or env file is needed to run the app. Development
does not read `deployments/.env` and does not reuse the previous shared development
database. Existing volumes are left intact. Source stays in your editor; build
outputs and dependencies stay inside each container.

Quality checks and migration generation still use host tools. Install .NET 10
SDK and Node.js 26 with npm, then run `make bootstrap` and `make check`, or their
`.\make.ps1` equivalents. `bootstrap` also creates the existing production env
template if absent; it is not needed for `dev`.

More details: [Local setup](docs/development/local-setup.md),
[Contributor guide](CONTRIBUTING.md).

## Production operations

From a source checkout:

```bash
make prod-pull
make prod-up
make prod-logs
make prod-backup
```

Production image builds from source are explicit:

```bash
make prod-build-up
```

Useful docs:

- [Configuration](docs/configuration.md)
- [Backups and restores](docs/operations/backups.md)
- [Updates and rollback](docs/operations/updates.md)
- [Troubleshooting](docs/operations/troubleshooting.md)

## Architecture

Household is moving toward a modular monolith:

- `backend/`: .NET 10 API, updater, feature modules, EF Core migrations, and platform code.
- `clients/web/`: Next.js 16 App Router UI.
- `deployments/`: Docker Compose and observability configuration.
- `docs/`: install, operations, architecture, and contributor documentation.

Feature data is separated by Postgres schemas such as `identity`, `budget`, and `audit`.

See [docs/architecture.md](docs/architecture.md).

## Security model

Household is intended for trusted local networks. Do not expose it directly to the public internet unless you add and maintain your own reverse proxy, TLS, access controls, and update practices.

The updater sidecar mounts the Docker socket so it can pull images and restart services. It is internal-only in Compose and protected by `HOUSEHOLD_UPDATER_TOKEN`, but Docker socket access is powerful and should only be used on a trusted host.

See [SECURITY.md](SECURITY.md).

## Documentation

Start at [docs/README.md](docs/README.md).

Key pages:

- [Home-server install](docs/install/home-server.md)
- [Local development setup](docs/development/local-setup.md)
- [Testing and checks](docs/development/testing.md)
- [Current status and roadmap](docs/roadmap.md)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), keep pull requests focused, and do not commit real env files, backups, logs, or generated output.

## License

Household is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

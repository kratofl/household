# Local development setup

The API, Next.js development server, and PostgreSQL run in Linux containers.
Source edits synchronize through Compose Watch; build outputs and dependencies
remain in the containers. No Windows source bind mounts or shared host caches
are needed. Container recreation restores dependencies from the image; only
database data needs a persistent volume.

## Prerequisites

- Git, Docker Desktop on Windows/macOS or Docker Engine on Linux.
- Docker Compose 2.32+ for `initial_sync` and Watch support.
- Make and a POSIX shell on macOS/Linux. On Windows, PowerShell and Git for
  Windows; the PowerShell launcher locates Git's bundled `sh.exe`.
- AMD64 or ARM64. No forced x86 emulation on Apple Silicon.

## Start and stop

From the checkout or worktree root:

| Action | macOS / Linux | Windows |
| --- | --- | --- |
| Start and watch | `make dev` | `.\make.ps1 dev` |
| Show URL and status | `make dev-info` | `.\make.ps1 dev-info` |
| Show Compose project name | `make dev-project` | `.\make.ps1 dev-project` |
| Follow application logs | `make dev-logs` | `.\make.ps1 dev-logs` |
| Stop this stack | `make dev-down` | `.\make.ps1 dev-down` |
| Reset this stack's data | `make reset-dev-db` | `.\make.ps1 reset-dev-db` |
| Restore a dump into this stack | `make seed-dev BACKUP=path` | `.\make.ps1 seed-dev -Backup path` |

The first start downloads and builds images, waits for PostgreSQL and API health,
then prints the web URL. Sign in as `admin` / `admin`. Keep this terminal open
for hot reload. Ctrl+C ends Watch, leaving services running; `dev-down` stops
them without deleting data. Run `dev` again to rebuild as necessary and resume
synchronization, including edits made while Watch was stopped.

Frontend package changes rebuild its image. Backend source/project changes are
synced to `dotnet watch`, which restores packages and rebuilds as needed. Edits
that cannot be hot-reloaded restart the API automatically. Dockerfile changes
rebuild the relevant service. Run `dev` again after changing Compose or the
root `.dockerignore`. Do not run two Watch sessions for the same worktree.

## Worktree isolation

`scripts/dev.sh` is the common implementation behind Make and PowerShell. It
uses the Git worktree root's folder name and a hash of its full path to derive
`household-dev-<folder>-<hash>`, passed explicitly with Compose `--project-name`.
Branch changes retain that identity. Moving a worktree changes it; stop the old
stack before moving, and retain its old project name if its volume is needed.

Each project has its own API, web, PostgreSQL, network, and database volume.
New worktrees seed their own admin account. They never share migration history
or automatically copy data from another worktree or machine. Image build cache
may be reused by Docker, but running filesystems and database writes are separate.
Stopping one stack does not stop another. Reset requires typing its exact project
name and deletes all that development project's volumes, including optional
observability data. Removing a Git worktree does not remove Docker resources.

Only the web service publishes a port, bound to `127.0.0.1`. Docker allocates it
without a separate find-free-port race. The URL may change on recreation; use
`dev-info` again, including after a dependency-triggered rebuild. Browser storage
is scoped to the URL, so a changed port may require signing in again.

The browser calls `/api/backend/*`. Next.js forwards requests internally to
`http://household-api:8090/api/v1`; the API connects to `household-db:5432`.
Those internal ports can be identical in every worktree. For database inspection,
use Docker Desktop's Exec terminal on that worktree's database container and run
`psql -U household -d household`. No database host port is needed.

Development loads only the tracked `deployments/dev.env` and fixed local service
settings. It does not read `deployments/.env`, `PROJECT_NAME`, or production
database settings. The former shared `household` development volume is not
imported, changed, or deleted. Production commands retain their existing setup.

`db-up` starts only this worktree's internal PostgreSQL. `db-down` aliases
`dev-down` to stop dependent services safely. The former host `api-dev` and
`web-dev` commands print a migration message; use `dev` instead.

Optional `observability-up`, `observability-down`, and `observability-logs` also
use the worktree project. Their published ports are dynamic; `dev-info` lists
them. They are not needed for normal development.

## Realistic test data

New worktrees start with only the seeded admin account. For UI or reporting work,
restore a dump made by `make prod-backup` (or taken from another worktree's
database) with `make seed-dev BACKUP=deployments/backups/<file>.dump`. The command
stops this worktree's API and web containers, runs `pg_restore --clean` against its
database, and starts the stack again so pending migrations apply on top of the
restored data. Accounts and passwords are then the ones from the dump. Both stacks
use the same PostgreSQL major version, so dumps restore without conversion.

Data flows into a worktree only. Never restore a development dump into production,
and keep dumps out of Git; `deployments/backups/` is ignored for that reason.

## Checks and migrations

The existing `bootstrap`, `doctor`, `check`, individual checks, and
`create-migration` commands still use host .NET 10 and Node.js 26/npm.
Install those tools and run `make bootstrap` / `.\make.ps1 bootstrap` before
checks. `doctor` checks those contributor tools, not just Docker runtime needs.
Tests launch their own PostgreSQL containers and do not use the worktree database.
Generated migration source is picked up by Watch like other source edits.

See [Testing](testing.md) and [Migrations](../db/migrations.md).

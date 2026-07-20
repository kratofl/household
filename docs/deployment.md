# Deployment overview

The production deployment is a Docker Compose stack made of:

| Service | Purpose | Host exposure |
| --- | --- | --- |
| `household-web` | Next.js web UI and backend proxy | Published on `HOUSEHOLD_WEB_PORT`, default `3000` |
| `household-api` | ASP.NET Core modular-monolith API | Internal Compose network only |
| `household-updater` | Internal update sidecar | Internal Compose network only |
| `household-db` | Postgres database | Internal Compose network only |

Optional observability services run behind the `observability` profile:

| Service | Purpose | Default port |
| --- | --- | --- |
| `grafana` | Logs UI | `3001` |
| `loki` | Log storage | `3100` |
| `alloy` | Docker log collector | `12345` |

## Install path

For a normal home-server install, use the release bundle and published images. Start with [home-server install](install/home-server.md).

For a source checkout:

```bash
make setup-env
make prod-pull
make prod-up
```

The default production Compose file does not build images. Local production-style builds are explicit:

```bash
make prod-build-up
```

## Persistent data

Keep these on persistent storage:

- `.env` or `deployments/.env`
- Docker named volume `household_db_data`
- `backups/` or `deployments/backups/`

The environment file contains secrets. Back it up securely and do not commit it.

## Updater security

The updater sidecar mounts the Docker socket so it can pull images and restart services. It is not published to the host and is protected by `HOUSEHOLD_UPDATER_TOKEN`, but Docker socket access is powerful. Only run the updater on a trusted host and trusted network.

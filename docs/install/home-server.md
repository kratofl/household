# Home-server install

Household is intended to run on a trusted home network. The default production install exposes only the web UI to the host. The API, Postgres, and updater sidecar stay on the internal Docker Compose network.

## Requirements

- A Linux home server, NAS, or VM that can run Docker Engine with the Docker Compose plugin.
- Outbound access to GitHub Container Registry (`ghcr.io`) and GitHub Releases.
- A private directory for the stack files, environment file, and backups.

Do not expose Household directly to the public internet unless you add and maintain your own hardening layer.

## Install from a release bundle

Create a directory for the app:

```bash
mkdir -p ~/household
cd ~/household
```

Download and unpack the latest release bundle:

```bash
curl -LO https://github.com/kratofl/household/releases/latest/download/household-release-bundle.tar.gz
tar -xzf household-release-bundle.tar.gz
```

Create your private env file:

```bash
cp .env.example .env
```

Generate three separate secrets:

```bash
openssl rand -base64 36
openssl rand -base64 36
openssl rand -base64 36
```

Edit `.env` and set at least:

| Variable | Required action |
| --- | --- |
| `HOUSEHOLD_DB_PASSWORD` | Use a generated value. |
| `HOUSEHOLD_UPDATER_TOKEN` | Use a different generated value. |
| `HOUSEHOLD_SEED_DEMO_USER` | Set to `true` for the first boot only. |
| `HOUSEHOLD_SEED_DEMO_USER_PASSWORD` | Use a third generated value. |

Check the configuration:

```bash
docker compose --env-file .env -f docker-compose.yml config --quiet
```

Pull and start the stack:

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
```

Open the web UI:

```text
http://<server-ip>:3000
```

If you changed `HOUSEHOLD_WEB_PORT`, use that port instead.

## First admin account

On first boot, the API creates or updates the seed admin when `HOUSEHOLD_SEED_DEMO_USER=true`.

After logging in and confirming the admin account is usable:

1. Set `HOUSEHOLD_SEED_DEMO_USER=false` in `.env`.
2. Restart the stack:

```bash
docker compose --env-file .env -f docker-compose.yml up -d
```

Keep `.env` private. It contains database and updater credentials.

## Install from a source checkout

For maintainers or contributors running from a clone:

```bash
git clone https://github.com/kratofl/household.git
cd household
make setup-env
```

Edit `deployments/.env`, then start production images:

```bash
make prod-pull
make prod-up
```

To build production images locally from source instead:

```bash
make prod-build-up
```

## Optional observability

Grafana, Loki, and Grafana Alloy are available behind the `observability` profile:

```bash
docker compose --env-file .env -f docker-compose.yml --profile observability up -d
```

In a source checkout, use:

```bash
make prod-observability-up
```

Grafana is available on `GRAFANA_PORT`, default `3001`.

## Updating

Admin users can check releases from the web UI when the updater sidecar is configured. You can also update manually by creating a backup, changing `HOUSEHOLD_VERSION`, pulling images, and restarting. See [updates and rollback](../operations/updates.md).

## Backups

Back up before every update and before risky maintenance. See [backups and restores](../operations/backups.md).

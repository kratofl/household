# Updates and rollback

Household uses GitHub Releases as update channels:

- Stable channel: normal GitHub Releases.
- Unstable channel: prereleases.

`HOUSEHOLD_VERSION` controls the image tag used by Docker Compose. Use a specific release tag for pinned installs, `stable` for the latest stable channel, or `unstable` for prereleases.

## In-app updates

When `household-updater` is running, admin users can check releases from the web UI and start an update.

The updater sidecar:

1. Updates `HOUSEHOLD_VERSION` in the stack env file.
2. Creates a Postgres backup in the stack backup directory.
3. Pulls the tagged API and web images.
4. Restarts API and web services.

The updater mounts the Docker socket. Keep it internal to the Compose network and protect it with a long random `HOUSEHOLD_UPDATER_TOKEN`.

## Manual update from a release-bundle install

Run this from the directory that contains `.env` and `docker-compose.yml`:

```bash
mkdir -p backups
docker compose --env-file .env -f docker-compose.yml exec -T household-db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/household-before-update-$(date -u +%Y%m%d%H%M%S).dump"
```

Edit `.env` and set `HOUSEHOLD_VERSION` to the target release tag, `stable`, or `unstable`, then run:

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
```

## Manual update from a source checkout

```bash
make prod-backup
```

Edit `deployments/.env`, then run:

```bash
make prod-pull
make prod-up
```

## Rollback

1. Stop the stack or leave only Postgres running.
2. Set `HOUSEHOLD_VERSION` back to the previous known-good version.
3. Restore the backup created before the update.
4. Pull and start the stack again.

See [backups and restores](backups.md) for restore commands.

## Release artifacts

Release bundles include:

- `docker-compose.yml`
- `.env.example`
- `INSTALL.md`
- `UPGRADE.md`
- `household-release.json`
- `SHA256SUMS`

Do not publish or share your real `.env`.

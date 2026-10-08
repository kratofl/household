# Updates and rollback

Household uses GitHub Releases as update channels:

- Stable channel: normal GitHub Releases.
- Unstable channel: prereleases.

`HOUSEHOLD_VERSION` controls the image tag used by Docker Compose. Use a specific release tag for pinned installs, `stable` for the latest stable channel, or `unstable` for prereleases.

Household does not update itself. Update by hand as below, or let a tool that manages Compose
stacks pull new images for the `stable` tag. Whatever runs the update must take a database backup
first: migrations run when the new API starts and are not reversed by going back to older images.

Installs from before the updater sidecar was removed still have a `household-updater` container.
Start the updated stack once with `up -d --remove-orphans` to remove it, and delete
`HOUSEHOLD_UPDATER_TOKEN`, `HOUSEHOLD_UPDATES_GITHUB_REPOSITORY`, and `HOUSEHOLD_UPDATES_TIMEOUT`
from `.env`.

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

Publishing a GitHub Release starts validation of its exact commit. Images and
install bundles are uploaded only after CI passes. The release page can exist
before its downloads are ready; wait for the Release workflow to finish before
installing it. If validation fails, inspect the failed job before retrying the run.

Release bundles include:

- `docker-compose.yml`
- `.env.example`
- `observability/`
- `INSTALL.md`
- `UPGRADE.md`
- `household-release.json`
- `SHA256SUMS`

Do not publish or share your real `.env`.

## Following releases from Git

After a stable release is published, the Release workflow moves the `stable` branch to the
release commit. A deployment that pulls Compose files from Git, such as a Komodo stack in Git
Repo mode with run directory `deployments`, should track `stable` rather than `main`: `main`
can carry Compose changes, such as a new Postgres image, before they are released. Prereleases do
not move the branch.

Development happens on `main` only. Nobody commits to `stable`; it moves forward with each
release, and the workflow fails instead of moving it backwards when an older commit is released.
Protect it with a ruleset that blocks deletion and force pushes. Fast-forward updates from the
workflow stay allowed.

# Backups and restores

Household stores application data in Postgres. Backups are Postgres custom-format dumps created with `pg_dump -Fc`.

Backups may contain personal and household data. Store them privately.

## Create a backup from a release-bundle install

Run this from the directory that contains `.env` and `docker-compose.yml`:

```bash
mkdir -p backups
docker compose --env-file .env -f docker-compose.yml exec -T household-db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/household-$(date -u +%Y%m%d%H%M%S).dump"
```

## Create a backup from a source checkout

```bash
make prod-backup
```

Backups are written to `deployments/backups/`.

## Restore a backup from a release-bundle install

Run this from the directory that contains `.env` and `docker-compose.yml`:

```bash
docker compose --env-file .env -f docker-compose.yml up -d household-db
docker compose --env-file .env -f docker-compose.yml exec -T household-db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < backups/<file>.dump
docker compose --env-file .env -f docker-compose.yml up -d
```

## Restore a backup from a source checkout

```bash
make prod-restore BACKUP=deployments/backups/<file>.dump
make prod-up
```

## Recommended routine

- Create a backup before every update.
- Periodically copy backups off the server.
- Test restore on a disposable stack before relying on backups.
- Keep the matching `.env` secure; database credentials and update settings live there.

#!/bin/sh
# Shared by Make and PowerShell, including Git for Windows. No host SDK required.
set -eu
cd "$(dirname "$0")/.."
root=$(git rev-parse --show-toplevel)
label=$(printf '%s' "$(basename "$root")" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | cut -c1-24)
identity=$(printf '%s\n' "$root" | git hash-object --stdin | cut -c1-12)
project="household-dev-${label}-${identity}"
# Every worktree of this repository records its stack here, so a stack can be
# found and removed after its worktree directory is gone.
registry="$(git rev-parse --path-format=absolute --git-common-dir)/household-dev-stacks"
compose_project() {
    name=$1; shift
    docker compose --project-name "$name" --env-file deployments/dev.env -f deployments/docker-compose.dev.yml "$@"
}
compose() {
    mkdir -p "$registry"
    printf '%s\n' "$root" > "$registry/$project"
    compose_project "$project" "$@"
}
# Removes containers, networks, and volumes of recorded stacks whose worktree no
# longer exists. Stacks that were never recorded are left alone.
prune() {
    [ -d "$registry" ] || return 0
    for record in "$registry"/household-dev-*; do
        [ -f "$record" ] || continue
        path=$(cat "$record")
        [ -e "$path/.git" ] && continue
        stale=$(basename "$record")
        printf 'Removing %s: worktree %s no longer exists\n' "$stale" "$path"
        if compose_project "$stale" --profile observability down --volumes --remove-orphans; then
            rm -f "$record"
        else
            printf 'Could not remove %s; will retry next time.\n' "$stale" >&2
        fi
    done
}
# Best-effort LAN address so the printed URL works from another machine.
# Prints nothing when no method fits the host, which only drops the LAN line.
lan_ip() {
    for iface in en0 en1 eth0; do
        address=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
        if [ -n "$address" ]; then printf '%s' "$address"; return 0; fi
    done
    hostname -I 2>/dev/null | awk 'NF { printf "%s", $1 }' || true
}
info() {
    printf 'Worktree: %s\nProject: %s\n' "$root" "$project"
    compose ps
    # Docker binds on all interfaces and picks a free host port per worktree,
    # so take the port from its output and build the URLs ourselves.
    port=$(compose port household-web 3000 2>/dev/null | sed 's/.*://' || true)
    if [ -n "$port" ]; then
        printf '\nWeb:   http://localhost:%s\n' "$port"
        ip=$(lan_ip)
        if [ -n "$ip" ]; then printf 'LAN:   http://%s:%s\n' "$ip" "$port"; fi
        printf 'Login: admin / admin\n'
    fi
}
case "${1:-dev}" in
    dev)
        prune
        compose up --build --detach --wait --wait-timeout 180 household-web
        info
        printf '\nWatching source changes. Ctrl+C ends watch; dev-down stops this stack.\n'
        compose watch --no-up
        ;;
    dev-info) info ;;
    dev-project) printf '%s\n' "$project" ;;
    dev-prune) prune ;;
    dev-down|db-down) compose --profile observability down --remove-orphans ;;
    dev-logs|logs) compose logs --follow ;;
    db-up) compose up --detach --wait household-db ;;
    db-logs) compose logs --follow household-db ;;
    api-dev|web-dev)
        printf 'Use dev for the complete Docker stack with hot reload.\n' >&2
        exit 1 ;;
    seed-dev)
        # Restore a pg_dump custom-format file into this worktree's database.
        # API and web are stopped so pg_restore --clean is not blocked by open
        # connections; starting web again brings the API back and applies any
        # pending migrations on top of the restored data.
        backup=${2:-}
        [ -n "$backup" ] || { printf 'Usage: seed-dev <backup.dump>\n' >&2; exit 1; }
        [ -f "$backup" ] || { printf 'Backup not found: %s\n' "$backup" >&2; exit 1; }
        compose stop household-api household-web
        compose up --detach --wait household-db
        printf 'Restoring %s into %s\n' "$backup" "$project"
        compose exec -T household-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$backup"
        compose up --detach --wait --wait-timeout 180 household-web
        info ;;
    reset-dev-db)
        printf 'Delete development data for %s? Type the project name: ' "$project"
        read -r confirmation
        confirmation=$(printf '%s' "$confirmation" | tr -d '\r')
        [ "$confirmation" = "$project" ] || { printf 'Cancelled.\n'; exit 1; }
        compose --profile observability down --volumes --remove-orphans ;;
    observability-up) compose --profile observability up --detach loki alloy grafana ;;
    observability-down) compose stop grafana alloy loki ;;
    observability-logs) compose logs --follow grafana alloy loki ;;
    *) printf 'Unknown development command: %s\n' "$1" >&2; exit 1 ;;
esac

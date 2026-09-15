#!/bin/sh
# Shared by Make and PowerShell, including Git for Windows. No host SDK required.
set -eu
cd "$(dirname "$0")/.."
root=$(git rev-parse --show-toplevel)
label=$(printf '%s' "$(basename "$root")" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | cut -c1-24)
identity=$(printf '%s\n' "$root" | git hash-object --stdin | cut -c1-12)
project="household-dev-${label}-${identity}"
compose() {
    docker compose --project-name "$project" --env-file deployments/dev.env -f deployments/docker-compose.dev.yml "$@"
}
info() {
    printf 'Worktree: %s\nProject: %s\n' "$root" "$project"
    compose ps
    address=$(compose port household-web 3000 2>/dev/null || true)
    if [ -n "$address" ]; then printf '\nWeb: http://%s\nLogin: admin / admin\n' "$address"; fi
}
case "${1:-dev}" in
    dev)
        compose up --build --detach --wait --wait-timeout 180 household-web
        info
        printf '\nWatching source changes. Ctrl+C ends watch; dev-down stops this stack.\n'
        compose watch --no-up
        ;;
    dev-info) info ;;
    dev-project) printf '%s\n' "$project" ;;
    dev-down|db-down) compose --profile observability down --remove-orphans ;;
    dev-logs|logs) compose logs --follow ;;
    db-up) compose up --detach --wait household-db ;;
    db-logs) compose logs --follow household-db ;;
    api-dev|web-dev)
        printf 'Use dev for the complete Docker stack with hot reload.\n' >&2
        exit 1 ;;
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

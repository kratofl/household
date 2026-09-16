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

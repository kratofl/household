# Current status and roadmap

Household is early-stage self-hosted software. The current work is focused on making the foundation installable, understandable, and safe to operate before broadening product features.

## Implemented foundation

- Docker Compose production stack with web, API, updater, and Postgres.
- Local development workflow with Docker Postgres, Go API, and Next.js web app.
- Identity users with active/pending status.
- Admin-oriented user/module management foundation.
- Access and refresh token sessions.
- Password change for logged-in users.
- GitHub Release checks and updater sidecar integration.
- Feature-owned database schemas and startup migrations.

## In progress

- Budget domain modeling and UI.
- Public documentation and release hardening.
- CI coverage for backend, web, Docker, and Compose.
- Safer, clearer release bundles for home-server installs.

## Planned product areas

- Budget accounts, categories, monthly limits, planned expenses, subscriptions, savings plans, and month-specific snapshots.
- Shopping list.
- Recipes and meal planning.
- Calendar.
- Waste schedule.

Planned areas should not be described as implemented until code and docs both support them.

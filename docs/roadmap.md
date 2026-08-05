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
- Complete Budget slice on the .NET modular monolith: append-only ledger,
  categories with history, recurring income and commitments, buffer and period
  close, savings goals, investments, wishlist, reminders, reports, and reviewed
  CSV import/export — localized in German and English with browser-tested
  journeys.

## In progress

- Public documentation and release hardening.
- CI coverage for backend, web, browser journeys, Docker, and Compose.
- Safer, clearer release bundles for home-server installs.

## Planned product areas

- Polished multi-step registration and cross-product account onboarding, building
  on the functional Budget setup included in the Budget slice.
- Shopping list.
- Recipes and meal planning.
- Calendar.
- Waste schedule.

Planned areas should not be described as implemented until code and docs both support them.

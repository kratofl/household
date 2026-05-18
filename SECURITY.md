# Security Policy

Household is designed for local-network self-hosting first. Do not expose it directly to the public internet unless you add and maintain your own hardening layer, such as a trusted reverse proxy, TLS, network access controls, and regular update practices.

## Supported versions

Security fixes are currently provided for the latest released version. Until the project reaches a stable public release cadence, upgrade guidance will be included in GitHub Releases.

## Reporting a vulnerability

Please do not open a public issue for vulnerabilities. Use GitHub private vulnerability reporting if it is enabled on the repository. If it is not enabled, contact the maintainer privately and include:

- A short description of the issue and impact.
- A minimal reproduction or affected endpoint/configuration.
- Whether the issue requires local-network access, admin access, or unauthenticated access.

## Self-hosting security notes

- Change all values copied from `deployments/.env.example` before first production use.
- Disable `HOUSEHOLD_SEED_DEMO_USER` after the first admin account is usable.
- Keep `deployments/.env` and `deployments/backups/` private and backed up.
- The updater sidecar uses Docker socket access so it can pull images and restart services. Keep it on the internal Compose network only and protect it with a long random `HOUSEHOLD_UPDATER_TOKEN`.
- Run the app behind your home-network firewall or VPN unless you have reviewed and accepted the risk of wider exposure.

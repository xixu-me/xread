# Security Policy

## Supported Versions

The supported release line is the latest `main` branch build and the container images published from it.

## Reporting a Vulnerability

Please open a private security advisory in GitHub when possible. If that is not available, open an issue with the minimum public detail needed to reproduce the problem and clearly mark it as security-sensitive.

## Dependency Governance

- Pull requests run `bun run security:audit`.
- Blocking policy is based on `bun audit`: new runtime `high` or `critical` findings fail CI.
- Development-only findings that are not yet practical to remove immediately must be recorded in `security/bun-audit-baseline.json` with a reason and review date.
- Scheduled GitHub Actions runs refresh the audit report and upload artifacts under `security-reports/`.

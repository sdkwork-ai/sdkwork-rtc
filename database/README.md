# RTC Database Module

Canonical lifecycle assets for `sdkwork-rtc` per `DATABASE_FRAMEWORK_SPEC.md`.

- moduleId: `rtc`
- serviceCode: `RTC`
- tablePrefix: `rtc_`

## Initialization state

This module is in **initialization state** for greenfield deployments:

1. **Baseline** — `database/ddl/baseline/{engine}/0001_rtc_baseline.sql` contains the full DDL snapshot.
2. **Migrations** — `database/migrations/{engine}/` is reserved for post-GA incremental schema changes only. `0002_provider_secret_columns` adds the sealed provider-secret columns and the provider-profile → provider-application link. `0003_rtc_provider_environment_check` constrains the provider `environment` stamps to the canonical environment set and switches the provider natural-key uniqueness to live-row-only partial unique indexes (DATABASE_SPEC DB017).
3. **Seeds** — the `standard` profile ships `002_rtc_provider_catalog.sql` (account → application → profile → route for every built-in provider) and `003_rtc_provider_credentials.sql` (credential-role placeholders). `lifecycle.seedOnBoot` is enabled so development, test, staging, demo, and production installs all provision the same provider catalog; the seed contains no secret material. Planned vendor catalog entries (no runtime adapter yet) are deliberately not seeded.
4. **Drift** — run `pnpm db:drift:check` before release.

## Commands

```bash
pnpm run db:validate
pnpm run db:materialize:contract
pnpm run db:plan
pnpm run db:init
pnpm run db:migrate
pnpm run db:seed
pnpm run db:status
pnpm run db:drift:check
```

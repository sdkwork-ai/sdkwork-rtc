# RTC topology profiles

Machine contract: `specs/topology.spec.json` (`schemaVersion: 5`, archetype `application-http-gateway`).

Platform standard: `../../sdkwork-specs/APP_RUNTIME_TOPOLOGY_ADOPTION.md`

## Active profiles

| Profile id | Command |
| --- | --- |
| `standalone.development` | `pnpm dev`, `pnpm dev:browser:postgres:standalone:local`, `pnpm dev:flutter-android`, `pnpm dev:server` |
| `cloud.development` | `pnpm dev:browser:cloud` |
| `cloud.production` | packaging / release |
| `standalone.demo` | demo / system demonstration (standalone) |
| `cloud.demo` | demo / system demonstration (cloud) |

Loader: `scripts/lib/rtc-topology.mjs` → `@sdkwork/app-topology`.

## Provider credential master secret

Provider secrets entered in `/admin/rtc/dashboard` are sealed with
AES-256-GCM before they reach `rtc_provider_credential`. The key comes from
`SDKWORK_RTC_PROVIDER_CREDENTIAL_MASTER_SECRET`:

- development and test profiles carry a local-only value in their
  `overrides/*.env` layer;
- staging, demo, and production must inject the value from the deployment
  secret store (never commit a production key). Without it, credential writes
  fail closed with a clear `master secret must be configured` error, and the
  RTC call path stays unavailable rather than signing with a placeholder.

Rotating the key: set the new value as the active master secret and move the
old value into `SDKWORK_RTC_PROVIDER_CREDENTIAL_LEGACY_MASTER_SECRETS`
(comma-separated) until existing credentials are re-entered.


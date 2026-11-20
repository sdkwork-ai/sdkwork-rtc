# Runbook — RTC provider initialization (English)

The RTC provider catalog covers the industry's mainstream vendors: 5 with implemented runtime adapters (volcengine, aliyun, tencent, agora, livekit) and 12 catalog-only planned vendors (huawei, netease, zego, baidu, rongcloud, zoom, twilio, aws-chime-sdk, azure-communication-services, jitsi, 100ms, daily). The admin dashboard (`/admin/dashboard`) shows one card per vendor; `adapterStatus=planned` vendors cannot be configured until their adapter ships.

## 1. Initialization mechanism (three tiers, storage-center pattern)

1. **Idempotent SQL seed** (database lifecycle layer): `database/seeds/common/002_rtc_provider_catalog.sql` + `003_rtc_provider_credentials.sql`. With `lifecycle.seedOnBoot=true`, every environment database (development, test, staging, demo, production) provisions the full account → application → credential placeholders → profile → route chain for the 5 implemented vendors on boot. The seed carries only `secret://` credential references — never secret material — and every insert is `ON CONFLICT DO NOTHING`, so re-runs never overwrite operator edits.
2. **Runtime bootstrap** (application startup layer): after hydration the gateway runs `ensure_provider_defaults_on_boot`, completing missing built-in chains for the console tenant (`SDKWORK_RTC_HYDRATE_TENANT_ID`, default `100001`). Creates only what is missing, never rewrites; disable with `SDKWORK_RTC_BOOTSTRAP_PROVIDER_ACCOUNTS=0|false|off`.
3. **One-click endpoint** (console operation layer): `POST /backend/v3/api/rtc/provider_defaults` (permission `rtc.provider_defaults.write`) returns an idempotent created/skipped report; used by the admin console and tenant provisioning.

## 2. Enabling a vendor per environment

Every environment has its own database; the same seed applies in each, and credentials are sealed per deployment (AES-256-GCM master secret), so development secrets never leak into staging or production. To enable a vendor:

1. Dashboard vendor card → Configure: enter the App ID, region, and each credential-role secret (sealed before persistence, never echoed back).
2. Or call `PATCH /backend/v3/api/rtc/provider_profiles/{id}` plus the credential commands (`credentialSecret` is write-only).
3. Verify with the card's Test action or `POST /provider_profiles/{id}/verify`. Until credentials resolve, the runtime fails closed (unsigned credentials are rejected outside development).

## 3. Environment stamps

`rtc_provider_account/application/profile.environment` is CHECK-constrained (`development|test|staging|production|demo`). The seed stamps `production`; admin lists accept an `environment` query parameter (provider accounts / provider profiles). The runtime bootstrap stamps rows it creates with the normalized `SDKWORK_RTC_ENVIRONMENT`.

## 4. Verification

```bash
pnpm run db:seed            # explicit idempotent seed
pnpm run db:status          # lifecycle state should be SEEDED
pnpm run db:drift:check     # baseline drift check
cargo test -p sdkwork-rtc-database-host   # seed/registry alignment contract
```

API smoke test: call `POST /backend/v3/api/rtc/provider_defaults` twice — the second call must report all created counters as 0 and `skippedAccounts` equal to the implemented vendor count.

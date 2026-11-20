-- sdkwork:migration
-- id: 0003_rtc_provider_environment_check
-- engine: postgres
-- module: sdkwork-rtc
-- purpose: Roll back the provider environment CHECK constraints and restore
--   the full-table natural-key uniqueness rules that predate the live-row-only
--   partial unique indexes.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: exclusive
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

DROP INDEX IF EXISTS uk_rtc_provider_profile_tenant_org_provider_code;
DROP INDEX IF EXISTS uk_rtc_provider_application_account_code;
DROP INDEX IF EXISTS uk_rtc_provider_account_tenant_org_provider_code;

ALTER TABLE rtc_provider_profile
    DROP CONSTRAINT IF EXISTS ck_rtc_provider_profile_environment;
ALTER TABLE rtc_provider_application
    DROP CONSTRAINT IF EXISTS ck_rtc_provider_application_environment;
ALTER TABLE rtc_provider_account
    DROP CONSTRAINT IF EXISTS ck_rtc_provider_account_environment;

ALTER TABLE rtc_provider_account
    ADD CONSTRAINT uk_rtc_provider_account_tenant_org_provider_code UNIQUE (
        tenant_id,
        organization_id,
        provider,
        code
    );
ALTER TABLE rtc_provider_application
    ADD CONSTRAINT uk_rtc_provider_application_account_code UNIQUE (
        provider_account_id,
        code
    );
ALTER TABLE rtc_provider_profile
    ADD CONSTRAINT uk_rtc_provider_profile_tenant_org_provider_code UNIQUE (tenant_id, organization_id, provider, code);

COMMIT;

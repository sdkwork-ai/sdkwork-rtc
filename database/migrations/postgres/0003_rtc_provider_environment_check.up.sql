-- sdkwork:migration
-- id: 0003_rtc_provider_environment_check
-- engine: postgres
-- module: sdkwork-rtc
-- purpose: Constrain the rtc_provider_account / rtc_provider_application /
--   rtc_provider_profile `environment` stamps to the canonical SDKWork
--   environment set (CONFIG_SPEC §4) and switch the provider natural-key
--   uniqueness rules to live-row-only partial unique indexes (DATABASE_SPEC
--   DB017: soft-deleted rows free their key for re-provisioning). Non-canonical
--   environment values are backfilled to 'production' before the CHECK is
--   added, matching the column defaults used by every fresh baseline install.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: exclusive
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

UPDATE rtc_provider_account
SET environment = 'production'
WHERE environment NOT IN ('development', 'test', 'staging', 'production', 'demo');

UPDATE rtc_provider_application
SET environment = 'production'
WHERE environment NOT IN ('development', 'test', 'staging', 'production', 'demo');

UPDATE rtc_provider_profile
SET environment = 'production'
WHERE environment NOT IN ('development', 'test', 'staging', 'production', 'demo');

ALTER TABLE rtc_provider_account
    DROP CONSTRAINT IF EXISTS uk_rtc_provider_account_tenant_org_provider_code;
ALTER TABLE rtc_provider_application
    DROP CONSTRAINT IF EXISTS uk_rtc_provider_application_account_code;
ALTER TABLE rtc_provider_profile
    DROP CONSTRAINT IF EXISTS uk_rtc_provider_profile_tenant_org_provider_code;

ALTER TABLE rtc_provider_account
    ADD CONSTRAINT ck_rtc_provider_account_environment CHECK (
        environment IN ('development', 'test', 'staging', 'production', 'demo')
    );
ALTER TABLE rtc_provider_application
    ADD CONSTRAINT ck_rtc_provider_application_environment CHECK (
        environment IN ('development', 'test', 'staging', 'production', 'demo')
    );
ALTER TABLE rtc_provider_profile
    ADD CONSTRAINT ck_rtc_provider_profile_environment CHECK (
        environment IN ('development', 'test', 'staging', 'production', 'demo')
    );

CREATE UNIQUE INDEX IF NOT EXISTS uk_rtc_provider_account_tenant_org_provider_code
    ON rtc_provider_account (tenant_id, organization_id, provider, code)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_rtc_provider_application_account_code
    ON rtc_provider_application (provider_account_id, code)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_rtc_provider_profile_tenant_org_provider_code
    ON rtc_provider_profile (tenant_id, organization_id, provider, code)
    WHERE deleted_at IS NULL;

COMMIT;

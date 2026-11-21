-- sdkwork:migration
-- id: 0002_provider_secret_columns
-- engine: postgres
-- module: sdkwork-rtc
-- purpose: Roll back the sealed provider credential columns and the provider
--   profile to provider application link.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: exclusive
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

DROP INDEX IF EXISTS idx_rtc_provider_profile_application;

ALTER TABLE rtc_provider_profile
    DROP COLUMN IF EXISTS provider_application_id;

ALTER TABLE rtc_provider_credential
    DROP COLUMN IF EXISTS secret_masked_label,
    DROP COLUMN IF EXISTS secret_algorithm,
    DROP COLUMN IF EXISTS secret_key_id,
    DROP COLUMN IF EXISTS secret_ciphertext,
    DROP COLUMN IF EXISTS credential_kind;

COMMIT;

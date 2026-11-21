-- sdkwork:migration
-- id: 0002_provider_secret_columns
-- engine: postgres
-- module: sdkwork-rtc
-- purpose: Store sealed RTC provider credential material and link a provider
--   profile to the provider application that owns the credentials. The admin
--   console can then accept a provider secret once, seal it with the
--   deployment master secret, and resolve it at call time without a redeploy.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: exclusive
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE rtc_provider_credential
    ADD COLUMN IF NOT EXISTS credential_kind VARCHAR(64),
    ADD COLUMN IF NOT EXISTS secret_ciphertext TEXT,
    ADD COLUMN IF NOT EXISTS secret_key_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS secret_algorithm VARCHAR(64),
    ADD COLUMN IF NOT EXISTS secret_masked_label VARCHAR(128);

ALTER TABLE rtc_provider_profile
    ADD COLUMN IF NOT EXISTS provider_application_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_rtc_provider_profile_application
    ON rtc_provider_profile (provider_application_id, status);

COMMIT;

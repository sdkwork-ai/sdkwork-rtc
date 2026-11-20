-- sdkwork:seed common
-- RTC provider credential placeholders (tenant 100001, organization 0).
--
-- Every credential row carries only a stable secret reference and a masked
-- label; no secret material is committed. The rows exist so the provider
-- console can show every supported credential role and the operator only has
-- to enter the provider secret once. Until then the rows stay `pending` and the
-- runtime fails closed instead of signing with a placeholder.
--
-- Credential roles: 1 rtc_token_signing, 2 open_api_signing, 3 usersig_signing,
-- 4 cloud_api_signing, 5 webhook_signing.
--
-- Idempotency: ON CONFLICT DO NOTHING. Reserved ids 9601-9699.

INSERT INTO rtc_provider_credential
    (id, uuid, tenant_id, organization_id, provider_account_id,
     provider_application_id, provider, credential_role, credential_kind,
     credential_label, credential_ref, credential_fingerprint, secret_version,
     status, valid_from, created_by, updated_by, created_at, updated_at, version)
VALUES
    (9601, 'seed-rtc-cred-volcengine-app-key', 100001, 0,
     'seed-rtc-account-volcengine', 'seed-rtc-app-volcengine', 'volcengine', 1,
     'secret_text', 'App Key', 'secret://rtc/volcengine/app-key', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9602, 'seed-rtc-cred-volcengine-open-api', 100001, 0,
     'seed-rtc-account-volcengine', 'seed-rtc-app-volcengine', 'volcengine', 2,
     'access_key_pair', 'Access Key ID', 'secret://rtc/volcengine/access-key-id',
     'secret://rtc/volcengine/secret-access-key', 'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9603, 'seed-rtc-cred-volcengine-webhook', 100001, 0,
     'seed-rtc-account-volcengine', 'seed-rtc-app-volcengine', 'volcengine', 5,
     'secret_text', 'Webhook Secret', 'secret://rtc/volcengine/webhook', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9604, 'seed-rtc-cred-tencent-usersig-key', 100001, 0,
     'seed-rtc-account-tencent', 'seed-rtc-app-tencent', 'tencent', 3,
     'secret_text', 'SDK Secret Key', 'secret://rtc/tencent/usersig-key', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9605, 'seed-rtc-cred-tencent-cloud-api', 100001, 0,
     'seed-rtc-account-tencent', 'seed-rtc-app-tencent', 'tencent', 4,
     'access_key_pair', 'SecretId', 'secret://rtc/tencent/secret-id',
     'secret://rtc/tencent/secret-key', 'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9606, 'seed-rtc-cred-tencent-webhook', 100001, 0,
     'seed-rtc-account-tencent', 'seed-rtc-app-tencent', 'tencent', 5,
     'secret_text', 'Webhook Secret', 'secret://rtc/tencent/webhook-key', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9607, 'seed-rtc-cred-agora-app-certificate', 100001, 0,
     'seed-rtc-account-agora', 'seed-rtc-app-agora', 'agora', 1,
     'secret_text', 'App Certificate', 'secret://rtc/agora/app-certificate',
     NULL, 'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9608, 'seed-rtc-cred-agora-webhook', 100001, 0,
     'seed-rtc-account-agora', 'seed-rtc-app-agora', 'agora', 5,
     'secret_text', 'Webhook Secret', 'secret://rtc/agora/webhook', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9609, 'seed-rtc-cred-aliyun-app-key', 100001, 0,
     'seed-rtc-account-aliyun', 'seed-rtc-app-aliyun', 'aliyun', 1,
     'secret_text', 'App Key', 'secret://rtc/aliyun/app-key', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9610, 'seed-rtc-cred-aliyun-webhook', 100001, 0,
     'seed-rtc-account-aliyun', 'seed-rtc-app-aliyun', 'aliyun', 5,
     'secret_text', 'Webhook Secret', 'secret://rtc/aliyun/webhook', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9611, 'seed-rtc-cred-livekit-api-secret', 100001, 0,
     'seed-rtc-account-livekit', 'seed-rtc-app-livekit', 'livekit', 1,
     'secret_text', 'API Secret', 'secret://rtc/livekit/api-secret', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9612, 'seed-rtc-cred-livekit-webhook', 100001, 0,
     'seed-rtc-account-livekit', 'seed-rtc-app-livekit', 'livekit', 5,
     'secret_text', 'Webhook Secret', 'secret://rtc/livekit/webhook', NULL,
     'placeholder', 2, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0)
ON CONFLICT DO NOTHING;

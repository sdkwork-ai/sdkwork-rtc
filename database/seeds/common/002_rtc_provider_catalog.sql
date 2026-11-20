-- sdkwork:seed common
-- RTC provider catalog bootstrap for the tenant that owns the production
-- console (tenant 100001, organization 0).
--
-- Why this exists
-- ---------------
-- The RTC console opens on an empty provider plane unless the deployment has a
-- complete account -> application -> profile -> route chain. With no rows the
-- first call fails with "No active RTC provider profile is configured" and an
-- operator has to rebuild five levels by hand before a single test call works.
--
-- Every built-in provider supported by the RTC plugin registry is registered
-- here with deployment defaults from specs/provider-schemas. The application id
-- and credentials are deliberate placeholders: the operator replaces the App ID
-- and enters the provider secret once in the admin console, then calls work.
-- Credentials live in 003_rtc_provider_credentials.sql and are never written
-- here as secret material.
--
-- Per-environment initialization
-- ------------------------------
-- This standard seed set is applied on boot in EVERY environment database
-- (development, test, staging, demo, production — see database.manifest.json
-- `seedOnBoot: true` and sdkwork-rtc-database-host). Each environment therefore
-- always starts with a complete provider account chain, satisfying the
-- DATABASE_FRAMEWORK_SPEC initialization contract. The `environment` column on
-- the seeded rows carries the canonical console-facing stamp 'production'
-- (CHECK-constrained to development/test/staging/production/demo); operators of
-- non-production deployments keep using the same chain — the vendor secrets
-- they enter through the admin console are sealed per deployment, so a
-- development database's credentials never leak into staging or production.
--
-- Planned vendor coverage
-- -----------------------
-- specs/provider-registry/platform-default.json additionally declares planned
-- industry vendors (huawei, netease, zego, baidu, rongcloud, zoom, twilio,
-- aws-chime-sdk, azure-communication-services, jitsi, 100ms, daily) that have
-- no runtime adapter yet. They appear in the admin catalog (provider_schemas
-- with adapterStatus "planned") but are deliberately NOT seeded here and every
-- configuration write against them is rejected until their adapter ships.
--
-- Idempotency: every insert is ON CONFLICT DO NOTHING, so re-running the seed
-- never rewrites an operator edit (a renamed profile, a re-pointed route).
-- Deterministic ids: fixed small ids far below the runtime id range, mirroring
-- the storage-center seed convention (database/seeds/common/002_* in the host
-- module).
--
-- Reserved id blocks: accounts 9301-9399, applications 9401-9499,
-- profiles 9501-9599, credentials 9601-9699, routes 9701-9799.

INSERT INTO rtc_provider_account
    (id, uuid, tenant_id, organization_id, provider, code, name, status,
     environment, external_tenant_id, cloud_account_id, project_id,
     resource_group_id, created_by, updated_by, created_at, updated_at, version)
VALUES
    (9301, 'seed-rtc-account-volcengine', 100001, 0, 'volcengine', 'default',
     'Volcengine RTC', 1, 'production', NULL, NULL, NULL, NULL, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9302, 'seed-rtc-account-tencent', 100001, 0, 'tencent', 'default',
     'Tencent Cloud TRTC', 1, 'production', NULL, NULL, NULL, NULL, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9303, 'seed-rtc-account-agora', 100001, 0, 'agora', 'default',
     'Agora RTC', 1, 'production', NULL, NULL, NULL, NULL, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9304, 'seed-rtc-account-aliyun', 100001, 0, 'aliyun', 'default',
     'Alibaba Cloud RTC', 1, 'production', NULL, NULL, NULL, NULL, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9305, 'seed-rtc-account-livekit', 100001, 0, 'livekit', 'default',
     'LiveKit RTC', 1, 'production', NULL, NULL, NULL, NULL, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
ON CONFLICT DO NOTHING;

INSERT INTO rtc_provider_application
    (id, uuid, tenant_id, organization_id, provider_account_id, provider, code,
     name, status, environment, region, provider_application_id,
     provider_application_id_kind, access_endpoint, api_endpoint, api_host,
     api_version, webhook_callback_url, config_snapshot, created_by, updated_by,
     created_at, updated_at, version)
VALUES
    (9401, 'seed-rtc-app-volcengine', 100001, 0, 'seed-rtc-account-volcengine',
     'volcengine', 'default', 'Volcengine RTC App', 1, 'production', 'cn-beijing',
     'seed-volcengine-app-id', 'volcengine_app_id',
     'wss://rtc.volcengine.local/session', 'https://rtc.volcengineapi.com',
     'rtc.volcengineapi.com', '2023-11-01', NULL, '{}'::jsonb, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9402, 'seed-rtc-app-tencent', 100001, 0, 'seed-rtc-account-tencent',
     'tencent', 'default', 'Tencent Cloud TRTC App', 1, 'production', 'ap-guangzhou',
     'seed-tencent-sdk-app-id', 'tencent_sdk_app_id',
     'wss://rtc.tencent.local/session', 'https://trtc.tencentcloudapi.com',
     'trtc.tencentcloudapi.com', '2019-07-22', NULL, '{}'::jsonb, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9403, 'seed-rtc-app-agora', 100001, 0, 'seed-rtc-account-agora',
     'agora', 'default', 'Agora RTC App', 1, 'production', 'global',
     'seed-agora-app-id', 'app_id', 'wss://rtc.agora.local/session', NULL, NULL,
     NULL, NULL, '{}'::jsonb, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9404, 'seed-rtc-app-aliyun', 100001, 0, 'seed-rtc-account-aliyun',
     'aliyun', 'default', 'Alibaba Cloud RTC App', 1, 'production', 'cn-shanghai',
     'seed-aliyun-app-id', 'app_id', 'wss://rtc.aliyun.local/session', NULL, NULL,
     NULL, NULL, '{}'::jsonb, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9405, 'seed-rtc-app-livekit', 100001, 0, 'seed-rtc-account-livekit',
     'livekit', 'default', 'LiveKit RTC App', 1, 'production', 'self-hosted',
     'seed-livekit-api-key', 'api_key', 'wss://rtc.livekit.local/session',
     'https://livekit.local', NULL, NULL, NULL, '{}'::jsonb, 0, 0,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
ON CONFLICT DO NOTHING;

INSERT INTO rtc_provider_profile
    (id, uuid, tenant_id, organization_id, provider, code, name, status,
     is_default, priority, environment, region, provider_application_id,
     provider_app_id, endpoint, credential_ref, credential_fingerprint,
     webhook_secret_ref, webhook_secret_fingerprint, capability_snapshot,
     config_snapshot, health_status, created_by, updated_by, created_at,
     updated_at, version)
VALUES
    (9501, 'seed-rtc-profile-volcengine', 100001, 0, 'volcengine', 'default',
     'Volcengine RTC', 1, TRUE, 0, 'production', 'cn-beijing',
     'seed-rtc-app-volcengine', 'seed-volcengine-app-id',
     'wss://rtc.volcengine.local/session', 'secret://rtc/volcengine/app-key', NULL,
     'secret://rtc/volcengine/webhook', NULL,
     '{"audio":true,"video":true,"live":true,"liveBroadcast":true,"liveAudience":true,"cdnRelay":true,"screenShare":true,"recording":true,"webhook":true,"activeQuery":true,"maxParticipants":null,"supportedRegions":["cn-beijing","cn-shanghai","cn-guangzhou","ap-southeast-1"],"providerFeatures":{}}'::jsonb,
     '{"credentialTtlSeconds":3600}'::jsonb, 0, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9502, 'seed-rtc-profile-tencent', 100001, 0, 'tencent', 'default',
     'Tencent Cloud TRTC', 1, FALSE, 100, 'production', 'ap-guangzhou',
     'seed-rtc-app-tencent', 'seed-tencent-sdk-app-id',
     'wss://rtc.tencent.local/session', 'secret://rtc/tencent/usersig-key', NULL,
     'secret://rtc/tencent/webhook-key', NULL,
     '{"audio":true,"video":true,"live":true,"liveBroadcast":true,"liveAudience":true,"cdnRelay":true,"screenShare":true,"recording":true,"webhook":true,"activeQuery":true,"maxParticipants":null,"supportedRegions":["ap-guangzhou","ap-shanghai","ap-beijing","ap-hongkong","na-siliconvalley","eu-frankfurt"],"providerFeatures":{}}'::jsonb,
     '{"credentialTtlSeconds":3600}'::jsonb, 0, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9503, 'seed-rtc-profile-agora', 100001, 0, 'agora', 'default',
     'Agora RTC', 1, FALSE, 110, 'production', 'global',
     'seed-rtc-app-agora', 'seed-agora-app-id',
     'wss://rtc.agora.local/session', 'secret://rtc/agora/app-certificate', NULL,
     'secret://rtc/agora/webhook', NULL,
     '{"audio":true,"video":true,"live":true,"liveBroadcast":true,"liveAudience":true,"cdnRelay":true,"screenShare":true,"recording":true,"webhook":true,"activeQuery":true,"maxParticipants":null,"supportedRegions":["global","cn","na","eu","ap"],"providerFeatures":{}}'::jsonb,
     '{"credentialTtlSeconds":3600}'::jsonb, 0, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9504, 'seed-rtc-profile-aliyun', 100001, 0, 'aliyun', 'default',
     'Alibaba Cloud RTC', 1, FALSE, 120, 'production', 'cn-shanghai',
     'seed-rtc-app-aliyun', 'seed-aliyun-app-id',
     'wss://rtc.aliyun.local/session', 'secret://rtc/aliyun/app-key', NULL,
     'secret://rtc/aliyun/webhook', NULL,
     '{"audio":true,"video":true,"live":true,"liveBroadcast":true,"liveAudience":true,"cdnRelay":true,"screenShare":true,"recording":true,"webhook":true,"activeQuery":true,"maxParticipants":null,"supportedRegions":["cn-shanghai","cn-beijing","cn-hangzhou","ap-southeast-1"],"providerFeatures":{}}'::jsonb,
     '{"credentialTtlSeconds":3600}'::jsonb, 0, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0),
    (9505, 'seed-rtc-profile-livekit', 100001, 0, 'livekit', 'default',
     'LiveKit RTC', 1, FALSE, 130, 'production', 'self-hosted',
     'seed-rtc-app-livekit', 'seed-livekit-api-key',
     'wss://rtc.livekit.local/session', 'secret://rtc/livekit/api-secret', NULL,
     'secret://rtc/livekit/webhook', NULL,
     '{"audio":true,"video":true,"live":true,"liveBroadcast":true,"liveAudience":true,"cdnRelay":true,"screenShare":true,"recording":true,"webhook":true,"activeQuery":true,"maxParticipants":null,"supportedRegions":["self-hosted"],"providerFeatures":{}}'::jsonb,
     '{"credentialTtlSeconds":3600}'::jsonb, 0, 0, 0, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, 0)
ON CONFLICT DO NOTHING;

INSERT INTO rtc_provider_route
    (id, uuid, tenant_id, organization_id, provider_profile_id, route_type,
     region, priority, status, created_at, updated_at, version)
VALUES
    (9701, 'seed-rtc-route-volcengine-cn-beijing', 100001, 0,
     'seed-rtc-profile-volcengine', 'region', 'cn-beijing', 100, 1,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9702, 'seed-rtc-route-tencent-ap-guangzhou', 100001, 0,
     'seed-rtc-profile-tencent', 'region', 'ap-guangzhou', 100, 1,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9703, 'seed-rtc-route-agora-global', 100001, 0,
     'seed-rtc-profile-agora', 'region', 'global', 100, 1,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9704, 'seed-rtc-route-aliyun-cn-shanghai', 100001, 0,
     'seed-rtc-profile-aliyun', 'region', 'cn-shanghai', 100, 1,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    (9705, 'seed-rtc-route-livekit-self-hosted', 100001, 0,
     'seed-rtc-profile-livekit', 'region', 'self-hosted', 100, 1,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
ON CONFLICT DO NOTHING;

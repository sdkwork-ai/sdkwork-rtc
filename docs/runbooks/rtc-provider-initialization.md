# Runbook — RTC 供应商初始化（中文）

供应商目录对齐行业主流 RTC 厂商：5 家已接入运行时适配器（volcengine、aliyun、tencent、agora、livekit），另有 12 家已进入目录、适配器待接入（huawei、netease、zego、baidu、rongcloud、zoom、twilio、aws-chime-sdk、azure-communication-services、jitsi、100ms、daily）。管理台仪表盘（`/admin/dashboard`）按厂商卡片展示状态；`adapterStatus=planned` 的厂商在适配器落地前不可配置。

## 1. 初始化机制（三层，存储中心范式）

1. **幂等 SQL 种子**（数据库生命周期层）：`database/seeds/common/002_rtc_provider_catalog.sql` + `003_rtc_provider_credentials.sql`。`lifecycle.seedOnBoot=true`，因此开发、测试、预发、演示、生产每个环境的数据库启动时都会自动补齐 5 家已接入厂商的完整 链路（账户 → 应用 → 凭证占位 → 配置档案 → 路由）。种子只含 `secret://` 凭证引用，绝无密钥明文；全部 `ON CONFLICT DO NOTHING`，重复执行不覆盖运营修改。
2. **运行时 bootstrap**（应用启动层）：网关启动注水（hydrate）后执行 `ensure_provider_defaults_on_boot`，为控制台租户（`SDKWORK_RTC_HYDRATE_TENANT_ID`，默认 `100001`）补齐缺失的内置链路。只建缺失、永不覆盖；`SDKWORK_RTC_BOOTSTRAP_PROVIDER_ACCOUNTS=0|false|off` 可关闭。
3. **一键初始化端点**（管理台操作层）：`POST /backend/v3/api/rtc/provider_defaults`（权限 `rtc.provider_defaults.write`），幂等返回创建/跳过计数报告；供管理台与新租户初始化使用。

## 2. 各环境启用供应商

每个环境的数据库独立，同一份种子在各自库内生效；凭证按部署封存（AES-256-GCM 主密钥），因此开发库的密钥不会进入预发/生产。启用一家厂商：

1. 管理台仪表盘对应厂商卡片 → 配置：填 App ID、区域、各凭证角色密钥（写库前加密，不回显）。
2. 或调用 `PATCH /backend/v3/api/rtc/provider_profiles/{id}` + 凭证命令（`credentialSecret` 为 write-only）。
3. 保存后用卡片"测试"或 `POST /provider_profiles/{id}/verify` 验证。凭证就绪前运行时 fail-closed（生产环境拒绝未签名凭证）。

## 3. 环境标记

`rtc_provider_account/application/profile.environment` 受 CHECK 约束（`development|test|staging|production|demo`）。种子默认 `production` 标记；管理台列表可用 `environment` 查询参数过滤（provider accounts / provider profiles）。运行时 bootstrap 按 `SDKWORK_RTC_ENVIRONMENT` 规范化后标记新建行。

## 4. 验证

```bash
pnpm run db:seed            # 显式补种子（幂等）
pnpm run db:status          # 生命周期状态应为 SEEDED
pnpm run db:drift:check     # 基线漂移检查
cargo test -p sdkwork-rtc-database-host   # 种子/注册表对齐契约
```

接口冒烟：`POST /backend/v3/api/rtc/provider_defaults` 两次调用，第二次报告 created 计数全部为 0、skippedAccounts 等于已接入厂商数。

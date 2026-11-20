use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::provider::descriptor::{ProviderDomain, ProviderPluginDescriptor};

/// Catalog status of a provider kind: `implemented` kinds have a runtime
/// adapter registered in the plugin registry; `planned` kinds are declared for
/// admin-console visibility only and every configuration write against them is
/// rejected until the adapter ships.
pub const ADAPTER_STATUS_IMPLEMENTED: &str = "implemented";
pub const ADAPTER_STATUS_PLANNED: &str = "planned";

fn default_adapter_status() -> String {
    ADAPTER_STATUS_IMPLEMENTED.to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderConfigSchema {
    pub provider: String,
    pub display_name: String,
    pub description: String,
    #[serde(default = "default_adapter_status")]
    pub adapter_status: String,
    pub account_fields: Vec<ConfigFieldSchema>,
    pub application_fields: Vec<ConfigFieldSchema>,
    pub credential_roles: Vec<CredentialRoleSchema>,
    pub profile_fields: Vec<ConfigFieldSchema>,
    pub optional_capabilities: Vec<String>,
    pub required_capabilities: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfigFieldSchema {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub required: bool,
    pub default: Option<JsonValue>,
    pub placeholder: Option<String>,
    pub values: Option<Vec<String>>,
    pub min: Option<i64>,
    pub max: Option<i64>,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CredentialRoleSchema {
    pub role: String,
    pub label: String,
    pub description: String,
    pub fields: Vec<ConfigFieldSchema>,
}

pub fn load_provider_config_schema(provider: &str) -> Option<ProviderConfigSchema> {
    let schema_json = match provider {
        "tencent" => include_str!("../../../../specs/provider-schemas/tencent.json"),
        "volcengine" => include_str!("../../../../specs/provider-schemas/volcengine.json"),
        "agora" => include_str!("../../../../specs/provider-schemas/agora.json"),
        "aliyun" => include_str!("../../../../specs/provider-schemas/aliyun.json"),
        "livekit" => include_str!("../../../../specs/provider-schemas/livekit.json"),
        "huawei" => include_str!("../../../../specs/provider-schemas/huawei.json"),
        "netease" => include_str!("../../../../specs/provider-schemas/netease.json"),
        "zego" => include_str!("../../../../specs/provider-schemas/zego.json"),
        "baidu" => include_str!("../../../../specs/provider-schemas/baidu.json"),
        "rongcloud" => include_str!("../../../../specs/provider-schemas/rongcloud.json"),
        "zoom" => include_str!("../../../../specs/provider-schemas/zoom.json"),
        "twilio" => include_str!("../../../../specs/provider-schemas/twilio.json"),
        "aws-chime-sdk" => include_str!("../../../../specs/provider-schemas/aws-chime-sdk.json"),
        "azure-communication-services" => {
            include_str!("../../../../specs/provider-schemas/azure-communication-services.json")
        }
        "jitsi" => include_str!("../../../../specs/provider-schemas/jitsi.json"),
        "100ms" => include_str!("../../../../specs/provider-schemas/100ms.json"),
        "daily" => include_str!("../../../../specs/provider-schemas/daily.json"),
        _ => return None,
    };
    serde_json::from_str(schema_json).ok()
}

/// Catalog order: implemented adapters first, then planned vendor entries so
/// the admin console lists the whole industry landscape in registry order.
pub fn list_provider_config_schemas() -> Vec<ProviderConfigSchema> {
    [
        "volcengine",
        "aliyun",
        "tencent",
        "agora",
        "livekit",
        "huawei",
        "netease",
        "zego",
        "baidu",
        "rongcloud",
        "zoom",
        "twilio",
        "aws-chime-sdk",
        "azure-communication-services",
        "jitsi",
        "100ms",
        "daily",
    ]
    .iter()
    .filter_map(|provider| load_provider_config_schema(provider))
    .collect()
}

pub fn plugin_descriptor_from_provider_schema(
    plugin_id: impl Into<String>,
    provider_kind: impl Into<String>,
    display_name: impl Into<String>,
    default_selected: bool,
) -> Result<ProviderPluginDescriptor, String> {
    let provider_kind = provider_kind.into();
    let schema = load_provider_config_schema(provider_kind.as_str()).ok_or_else(|| {
        format!("missing provider config schema for provider kind `{provider_kind}`")
    })?;
    Ok(ProviderPluginDescriptor::new(
        plugin_id,
        ProviderDomain::Rtc,
        provider_kind.as_str(),
        display_name.into(),
    )
    .with_default_selected(default_selected)
    .with_required_capabilities(schema.required_capabilities)
    .with_optional_capabilities(schema.optional_capabilities))
}

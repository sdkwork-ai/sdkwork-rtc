use std::path::PathBuf;
use std::sync::Arc;

use sdkwork_database_config::DatabaseConfig;
use sdkwork_database_lifecycle::{LifecycleOrchestrator, lifecycle_options_from_env};
use sdkwork_database_spi::{DatabaseAssetProvider, DatabaseManifest, DefaultDatabaseModule};
use sdkwork_database_sqlx::{DatabasePool, create_pool_from_config};

pub struct RtcDatabaseHost {
    pool: DatabasePool,
    module: Arc<DefaultDatabaseModule>,
}

impl RtcDatabaseHost {
    pub fn pool(&self) -> &DatabasePool {
        &self.pool
    }

    pub fn module(&self) -> Arc<DefaultDatabaseModule> {
        self.module.clone()
    }
}

pub async fn bootstrap_rtc_database(pool: DatabasePool) -> Result<RtcDatabaseHost, String> {
    let app_root = resolve_app_root();
    let module = Arc::new(
        DefaultDatabaseModule::from_app_root(&app_root)
            .map_err(|error| format!("load rtc database module failed: {error}"))?,
    );
    let manifest = DatabaseManifest::from_file(module.manifest_path())
        .map_err(|error| format!("read rtc database manifest failed: {error}"))?;
    let options = lifecycle_options_from_env("RTC", &manifest);
    let orchestrator =
        LifecycleOrchestrator::new(pool.clone(), module.clone()).with_applied_by("sdkwork-rtc");

    orchestrator
        .init()
        .await
        .map_err(|error| format!("rtc database init failed: {error}"))?;

    // Apply additive post-GA migrations before the reference seed set. The
    // manifest keeps `autoMigrate` false for authoritative-server modules, so
    // the seed-enabled boot path is also the module's explicit lifecycle
    // upgrade point: a deployment that receives the new provider catalog must
    // first receive the additive provider-secret columns the catalog uses.
    if options.auto_migrate || options.seed_on_boot {
        orchestrator
            .migrate()
            .await
            .map_err(|error| format!("rtc database migrate failed: {error}"))?;
    }

    // Provider catalog reference data must exist in every environment: without
    // an account -> application -> profile -> route chain the console opens
    // empty and the first call fails with "No active RTC provider profile is
    // configured". The seed set is idempotent and contains only secret
    // references, never secret material, so applying it on boot is safe for
    // development, test, staging, demo and production installs.
    if options.seed_on_boot {
        orchestrator
            .seed(&options.seed_locale, &options.seed_profile)
            .await
            .map_err(|error| format!("rtc database seed failed: {error}"))?;
    }

    Ok(RtcDatabaseHost { pool, module })
}

pub async fn bootstrap_rtc_database_from_env() -> Result<RtcDatabaseHost, String> {
    let _ = dotenvy::dotenv();
    let config = DatabaseConfig::from_env("RTC")
        .map_err(|error| format!("read rtc database config failed: {error}"))?;
    let pool = create_pool_from_config(config)
        .await
        .map_err(|error| format!("create rtc database pool failed: {error}"))?;
    bootstrap_rtc_database(pool).await
}

fn resolve_app_root() -> PathBuf {
    std::env::var("SDKWORK_RTC_APP_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../..")
                .canonicalize()
                .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The provider catalog is reference data, not tenant-private data: every
    /// environment must ship the same standard seed set. This test guards the
    /// manifest wiring that makes the boot-time seed (and the explicit
    /// `pnpm db:seed`) provision the five built-in providers.
    #[test]
    fn standard_seed_profile_ships_the_provider_catalog() {
        let root = resolve_app_root();
        let seed_manifest =
            std::fs::read_to_string(root.join("database/seeds/seed.manifest.json"))
                .expect("read the RTC seed manifest");
        assert!(seed_manifest.contains("002_rtc_provider_catalog.sql"));
        assert!(seed_manifest.contains("003_rtc_provider_credentials.sql"));

        let database_manifest = std::fs::read_to_string(root.join("database/database.manifest.json"))
            .expect("read the RTC database manifest");
        assert!(
            database_manifest.contains("\"seedOnBoot\": true"),
            "provider catalog reference data must be applied on boot in every environment"
        );
    }

    /// Every built-in provider in the plugin registry must have a seeded
    /// account/application/profile/route chain. This keeps the catalog aligned
    /// with the provider adapters the runtime can actually serve.
    #[test]
    fn provider_catalog_covers_every_registered_plugin() {
        let root = resolve_app_root();
        let registry = std::fs::read_to_string(
            root.join("specs/provider-registry/platform-default.json"),
        )
        .expect("read the provider registry");
        let catalog =
            std::fs::read_to_string(root.join("database/seeds/common/002_rtc_provider_catalog.sql"))
                .expect("read the provider catalog seed");
        for provider in ["volcengine", "tencent", "agora", "aliyun", "livekit"] {
            assert!(
                registry.contains(&format!("\"{provider}\"")),
                "provider registry must declare {provider}"
            );
            assert!(
                catalog.contains(&format!("'{provider}'")),
                "provider catalog must seed {provider}"
            );
        }
    }
}

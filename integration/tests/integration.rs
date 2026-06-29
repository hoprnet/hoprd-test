//! Cross-repo integration throughput test.
//!
//! `#[ignore]` — requires external binaries + a container runtime. Run with:
//!
//! ```bash
//! export HOPRD_LOCALCLUSTER_BIN=/path/to/hoprd-localcluster
//! export HOPRD_BIN=/path/to/hoprd
//! export HOPRD_CHAIN_IMAGE=<bloklid-anvil image tag>
//! # optional: HOPRD_E2E_SCENARIOS=0-hop   (run a subset against the shared env)
//! cargo nextest run --run-ignored all -j 1
//! ```
//!
//! All registered scenarios (0-hop, 1-hop, …) run against one shared cluster +
//! edge client. See `hoprd_integration_test::scenario` to add more.

use hoprd_integration_test::{RunConfig, run};

#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a bloklid-anvil container"]
async fn integration_scenarios() -> anyhow::Result<()> {
    let cfg = RunConfig::from_env()?;
    tracing::info!(
        payload_bytes = cfg.payload_bytes,
        max_loss_pct = cfg.max_loss_pct,
        max_secs = cfg.max_secs,
        "starting integration scenarios"
    );
    run(&cfg).await
}

//! Integration-test framework for the HOPR stack.
//!
//! Brings up a 3-node `hoprd-localcluster` (anvil + blokli + 3 `hoprd` processes,
//! full-mesh channels — contracts deployed by the chain container, see
//! [`cluster`]) and an `edgli` edge client **once** into a shared
//! [`IntegrationEnv`](env::IntegrationEnv), then runs a list of [`Scenario`]s
//! against it without tearing the environment down between them.
//!
//! Each scenario opens its own session and is measured + gated independently, so
//! adding a new test is just a new [`Scenario`] impl in [`scenarios`] registered
//! in [`scenario::registry`]. Sessions are **UDP** (HOPR unreliable socket) to the
//! exit node's built-in loopback; metrics are goodput + datagram loss.
//!
//! ## Modes
//! - **Managed** (default): set `HOPRD_LOCALCLUSTER_BIN`, `HOPRD_BIN`,
//!   `HOPRD_CHAIN_IMAGE` (a `bloklid-anvil` image), optional
//!   `HOPRD_CONTAINER_RUNTIME` (default `docker`).
//! - **External**: set `HOPRD_CLUSTER_DATA_DIR` (+ `HOPRD_LOCALCLUSTER_BIN`).
//!
//! ## Env knobs
//! - `HOPRD_E2E_PAYLOAD_BYTES`      — payload size, 10–50 MiB (default 10 MiB).
//! - `HOPRD_E2E_SCENARIOS`          — comma list of scenario names (default all).
//! - `HOPRD_E2E_FLOOR_<NAME>_MBPS`  — per-scenario goodput floor (default 0 = off).
//! - `HOPRD_E2E_MAX_LOSS_PCT`       — max datagram loss percent (default 100 = off).
//! - `HOPRD_E2E_MAX_SECS`           — per-scenario timeout (default 600).
//! - `HOPRD_E2E_METRICS_PATH`       — metrics JSON output (default `metrics.json`).

pub mod cluster;
pub mod config;
pub mod env;
pub mod metrics;
pub mod pump;
pub mod scenario;
pub mod scenarios;

pub use config::RunConfig;

/// On-chain address type, re-exported so submodules share one definition.
pub use edgli::hopr_lib::api::types::primitive::prelude::Address;

use crate::{env::IntegrationEnv, metrics::write_metrics};

/// Set up the shared environment once, run every selected scenario against it
/// (no teardown between), write `metrics.json`, then fail if any scenario's gates
/// tripped. A scenario that errors or fails its gates does not stop the others.
pub async fn run(cfg: &RunConfig) -> anyhow::Result<()> {
    let env = IntegrationEnv::setup(cfg).await?;

    let mut metrics = Vec::new();
    let mut failures = Vec::new();

    for s in scenario::registry() {
        if !cfg.selected(s.name()) {
            tracing::info!("skipping scenario {} (not selected)", s.name());
            continue;
        }
        tracing::info!("── scenario: {} ──", s.name());
        match s.run(&env, cfg).await {
            Ok(metric) => {
                failures.extend(scenario::gate(cfg, &metric));
                metrics.push(metric);
            }
            Err(e) => failures.push(format!("{}: errored: {e:#}", s.name())),
        }
    }

    // Persist metrics regardless of pass/fail.
    if let Err(e) = write_metrics(&cfg.metrics_path, &metrics) {
        tracing::warn!("failed to write metrics: {e}");
    }

    // Tear the environment down once, after all scenarios.
    drop(env);

    anyhow::ensure!(
        failures.is_empty(),
        "integration gates failed:\n  - {}",
        failures.join("\n  - ")
    );
    tracing::info!("all scenarios passed ✓");
    Ok(())
}

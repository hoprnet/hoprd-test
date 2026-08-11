//! End-to-end integration test against the public **Rotsee** testnet (Gnosis Chain).
//!
//! Unlike `integration.rs` (which boots a local `hoprd-localcluster`), this test has no
//! cluster to bring up: it boots `edgli` on a pre-funded, on-chain-registered identity
//! supplied entirely through the environment, opens 0-hop and 1-hop loopback sessions to
//! a configured exit node, and pumps a payload through each — asserting arrival and
//! byte-integrity with the looser tolerances a public, NAT-traversed network warrants.
//!
//! `#[ignore]` and never run in CI: it requires a funded Gnosis identity and a reachable
//! exit node. Run it manually.
//!
//! ## Required env vars
//!
//! | Variable                         | Description                                   |
//! |----------------------------------|-----------------------------------------------|
//! | `EDGLI_ROTSEE_BLOKLI_URL`        | Blokli endpoint for Rotsee                    |
//! | `EDGLI_ROTSEE_IDENTITY_FILE`     | path to the funded keystore JSON              |
//! | `EDGLI_ROTSEE_IDENTITY_PASSWORD` | keystore password                             |
//! | `EDGLI_ROTSEE_SAFE_ADDRESS`      | Safe contract address (0x…)                   |
//! | `EDGLI_ROTSEE_MODULE_ADDRESS`    | HOPR module contract address (0x…)            |
//! | `EDGLI_ROTSEE_EXIT_NODE`         | exit node that runs the loopback service (0x…)|
//!
//! ```bash
//! export EDGLI_ROTSEE_BLOKLI_URL=https://blokli.rotsee.gnosisvpn.io
//! export EDGLI_ROTSEE_IDENTITY_FILE=/path/to/identity.json
//! export EDGLI_ROTSEE_IDENTITY_PASSWORD=…
//! export EDGLI_ROTSEE_SAFE_ADDRESS=0x…
//! export EDGLI_ROTSEE_MODULE_ADDRESS=0x…
//! export EDGLI_ROTSEE_EXIT_NODE=0x…
//! # --release: HOPR's async future chains overflow the default debug stack.
//! RUST_LOG=info,edgli=debug cargo test --test rotsee --release -- --ignored --nocapture
//! ```

use std::time::Duration;

use hoprd_integration_test::{IntegrationEnv, pump::pump_loopback};
use rand::RngExt as _;

/// Public-testnet payload — smaller than the local test's, to keep a manual run brisk.
const PAYLOAD_BYTES: usize = 4 * 1024 * 1024;
/// Per-hop transfer timeout; generous for real-network latency + rate-limiter ramp-up.
const PUMP_TIMEOUT: Duration = Duration::from_secs(600);
/// Public network over NAT is lossier than a local cluster — require ≥90% back.
const MIN_ARRIVAL_PCT: f64 = 90.0;

async fn run_hop(hops: usize, name: &str) -> anyhow::Result<()> {
    let env = IntegrationEnv::setup_rotsee().await?;
    let session = env.open_unreliable_session(hops).await?;

    let mut payload = vec![0u8; PAYLOAD_BYTES];
    rand::rng().fill(&mut payload[..]);

    let t = pump_loopback(session, &payload, name, PUMP_TIMEOUT).await?;

    assert!(
        t.arrival_pct() >= MIN_ARRIVAL_PCT,
        "{name}: only {:.2}% returned, need ≥{MIN_ARRIVAL_PCT:.0}%",
        t.arrival_pct(),
    );
    // Loss is tolerated up to the arrival floor, but returned bytes must be correct.
    assert!(
        t.received_bytes < t.sent_bytes || t.sha_ok,
        "{name}: full payload returned but corrupted (SHA-256 mismatch)",
    );
    Ok(())
}

#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires a funded Rotsee identity + reachable exit node (EDGLI_ROTSEE_*)"]
async fn rotsee_zero_hop() -> anyhow::Result<()> {
    run_hop(0, "rotsee 0-hop").await
}

#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires a funded Rotsee identity + reachable exit node (EDGLI_ROTSEE_*)"]
async fn rotsee_one_hop() -> anyhow::Result<()> {
    run_hop(1, "rotsee 1-hop").await
}

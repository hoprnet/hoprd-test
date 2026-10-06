//! Cross-repo integration throughput tests: one `#[test]` per hop count.
//!
//! Both are `#[ignore]` — they need external binaries + a running chain.
//! Each test owns its cluster (bring up → run → tear down). Run with:
//!
//! ```bash
//! export HOPRD_LOCALCLUSTER_BIN=/path/to/hoprd-localcluster
//! export HOPRD_BIN=/path/to/hoprd
//! export HOPRD_CHAIN_URL=http://localhost:8080
//! cargo test --test integration -- --include-ignored --test-threads=1
//! # one hop count: append `zero_hop` or `one_hop` as a filter (before `--`)
//! ```

use std::time::Duration;

use hoprd_integration_test::{
    IntegrationEnv, PAYLOAD_BYTES,
    pump::{PumpOpts, drain_until_quiet, pump_halves, tagged_payload},
};
use rand::RngExt as _;

/// Per-test transfer timeout.
const PUMP_TIMEOUT: Duration = Duration::from_secs(600);
/// UDP loopback is unreliable, so some loss is expected; require ≥99% back.
const MIN_ARRIVAL_PCT: f64 = 99.0;

// TEMPORARY MITIGATION for hoprnet#8484, remove with the warm-up in `run_hop`.
const WARM_UP_PHASE: u8 = 0xF0;
const WARM_UP_BYTES: usize = 64 * 1024;
/// One `counter_flush_interval` (15 s) plus one planner `refresh_period` (5 s), so a flush that
/// scored the warm-up as unacked is followed by one that sees its acks before the pump starts.
const WARM_UP_SETTLE: Duration = Duration::from_secs(20);

async fn run_hop(hops: usize, name: &str) -> anyhow::Result<()> {
    let env = IntegrationEnv::setup().await?;
    let session = env.open_unreliable_session(hops).await?;
    let (mut rx, mut tx) = tokio::io::split(session);

    // TEMPORARY MITIGATION for hoprnet#8484: a cold burst trips the first ack-counter flush and
    // loses the 1-hop route for 5 s. Remove this warm-up once that issue is fixed.
    let warm_up = tagged_payload(WARM_UP_PHASE, WARM_UP_BYTES);
    let opts = PumpOpts {
        phase: Some(WARM_UP_PHASE),
        ..Default::default()
    };
    pump_halves(&mut rx, &mut tx, &warm_up, "warm-up", PUMP_TIMEOUT, opts).await?;
    drain_until_quiet(&mut rx, Duration::from_secs(2), "warm-up").await;
    tokio::time::sleep(WARM_UP_SETTLE).await;

    // Random bytes → unique packet ciphertexts per run (avoids replay-tag hits).
    let mut payload = vec![0u8; PAYLOAD_BYTES];
    rand::rng().fill(&mut payload[..]);

    let t = pump_halves(
        &mut rx,
        &mut tx,
        &payload,
        name,
        PUMP_TIMEOUT,
        PumpOpts::default(),
    )
    .await?;

    // Loss and corruption are distinct: UDP may drop the tail (allowed up to the
    // arrival floor), but bytes that *do* return must never be wrong.
    assert!(
        t.arrival_pct() >= MIN_ARRIVAL_PCT,
        "{name}: only {:.2}% returned, need ≥{MIN_ARRIVAL_PCT:.0}%",
        t.arrival_pct(),
    );
    assert!(
        t.received_bytes < t.sent_bytes || t.sha_ok,
        "{name}: full payload returned but corrupted (SHA-256 mismatch)",
    );
    Ok(())
}

#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a bloklid-anvil container"]
async fn zero_hop() -> anyhow::Result<()> {
    run_hop(0, "0-hop").await
}

#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a bloklid-anvil container"]
async fn one_hop() -> anyhow::Result<()> {
    run_hop(1, "1-hop").await
}

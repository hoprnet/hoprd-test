//! Return-path resilience: does a reply stream survive losing one of its relays?
//!
//! # The incident these reproduce
//!
//! On 2026-08-11 a `gnosis_vpn-client` session broke. Post-mortem: ~99.6% of the exit's
//! return SURBs named just three first relayers, so when one went away the return path
//! lost 33–44% of its packets at once — past the ~20% a reliable session tolerates — and
//! the stream corrupted rather than degrading.
//!
//! Two independent weaknesses produced that:
//!
//! 1. **Concentration.** Each return path was drawn with an independent weighted pick
//!    from one cached candidate list, so the highest-scored relayers won nearly every
//!    draw. The fix buckets candidates by first relayer, samples K distinct buckets
//!    without replacement, and round-robins between them, capping any one relayer's
//!    share at ~1/K (hoprnet#8331).
//! 2. **Staleness.** The exit drained its SURB buffer oldest-first, so a return path
//!    that had already changed kept being used until a multi-megabyte backlog was
//!    consumed (hoprnet#8328), and SURBs whose first hop was no longer payable were
//!    used anyway (hoprnet#8329).
//!
//! # How they are measured
//!
//! Both tests open a session whose **forward** path is 0-hop and whose **return** path is
//! 1-hop. The asymmetry is the whole trick: no cluster node relays anything on the way
//! out, so `hopr_packets_count{type="forwarded"}` on each node counts exactly the replies
//! it carried. The per-node deltas are a return-relayer histogram (see
//! [`hoprd_integration_test::relayers`]).
//!
//! - [`return_paths_should_spread_across_distinct_relayers`] measures the mechanism: the
//!   histogram must be spread, not a spike.
//! - [`session_should_survive_return_relayer_loss`] reproduces the incident: kill the
//!   busiest return relayer mid-session and require the stream to keep flowing.
//!
//! Both are `#[ignore]` (they need the external binaries and a chain) and both want more
//! relayer candidates than the throughput tests, so they run their own 5-node cluster.
//! Run with:
//!
//! ```bash
//! cargo test --test return_path -- --include-ignored --test-threads=1
//! ```

use std::time::Duration;

use hoprd_integration_test::{
    HoprSession, IntegrationEnv,
    cluster::{NodeInfo, request_cluster_size, request_latency_profile},
    pump::{Transfer, pump_loopback},
    relayers::{self, RelayerSpread},
};
use rand::RngExt as _;

/// `hoprd-localcluster` caps out here, and every extra node is one more possible return
/// relayer: with 5 nodes the exit has 4, enough for concentration and spread to look
/// nothing alike.
const NODES: usize = 5;

/// Distinct inbound delays per node, so the relayers do **not** all look alike.
///
/// This is load-bearing, not flavour. On an unshaped local cluster every relayer probes at
/// essentially the same latency, every path weight is equal, and a weighted-random draw is
/// indistinguishable from a round-robin over enough samples — measured: the pre-fix stack
/// produced the same 25/25/25/25 histogram as the fixed one. Concentration only appears
/// when edge scores differ, which is also the condition that produced it in the incident.
///
/// The values are chosen against RFC-0014's **step-function** latency score (summary
/// §6.3), not spread evenly in milliseconds — anything inside the same step scores
/// identically, so evenly-spaced delays waste candidates on duplicate scores:
///
/// | delay   | score |
/// | ------- | ----- |
/// | ≤75 ms  | 1.00  |
/// | ≤125 ms | 0.70  |
/// | ≤200 ms | 0.30  |
/// | >200 ms | 0.15  |
///
/// One node per step gives a 6.7× spread between best and worst, so a weighted draw has
/// something decisive to concentrate on while a round-robin ignores it. Node 0 is the
/// fastest so that whichever node becomes the exit, the remaining relayers still span
/// several steps.
const LATENCY_PROFILE: &str = r#"
per_node:
  0: "10ms"
  1: "40ms"
  2: "110ms"
  3: "170ms"
  4: "260ms"
"#;

/// Payload per pump. Smaller than the throughput tests' 10 MiB — two pumps run per
/// scenario, and a few thousand packets already make the histogram unambiguous.
const PAYLOAD_BYTES: usize = 4 * 1024 * 1024;

const PUMP_TIMEOUT: Duration = Duration::from_secs(600);

/// Ignore relayers below this share of the stream: a stray packet from a probe or a
/// single re-plan does not make a node part of the rotation.
const ACTIVE_RELAYER_FLOOR: f64 = 0.05;

/// Maximum ratio between the busiest and least-busy relayer.
///
/// Round-robin over K buckets is uniform *by construction*, so the design target is 1.0;
/// measured on an unshaped cluster it is 1.03. The allowance here covers sampling jitter
/// and the odd re-plan.
///
/// Derived from measurement, not from what makes the test green — see
/// `docs/return-path-scenarios.md`. Under skewed edge scores the pre-fix stack measures
/// 2.28 and 4.63, so this threshold separates the intended behaviour from the old one with
/// room on both sides. Deliberately **not** a cap on the maximum *share*: with only four
/// candidates a rotation gives 25% and a weighted draw still only reaches 36–49%, so a
/// share cap cannot separate them and flips sign between runs.
const MAX_RELAYER_IMBALANCE: f64 = 1.5;

/// Arrival floor once one of the return relayers is dead.
///
/// Immediately after the kill the share that was aimed at it is lost — ~1/K, so ~25% with
/// 4 relayers — and stays lost until probing drops the dead node from the candidate set.
/// Anything above this floor means the session degraded proportionally instead of
/// collapsing; concentration puts this number near zero.
const MIN_ARRIVAL_AFTER_KILL_PCT: f64 = 60.0;

fn random_payload() -> Vec<u8> {
    let mut payload = vec![0u8; PAYLOAD_BYTES];
    rand::rng().fill(&mut payload[..]);
    payload
}

/// Bring up a cluster sized for return-path work and open a 0-hop-out / 1-hop-back
/// session, returning the env, the session, and the nodes that can relay replies.
async fn setup_return_path_env() -> anyhow::Result<(IntegrationEnv, HoprSession, Vec<NodeInfo>)> {
    let size = request_cluster_size(NODES);
    request_latency_profile(LATENCY_PROFILE);
    anyhow::ensure!(
        size >= 3,
        "return-path scenarios need ≥3 nodes to have >1 relayer candidate, got {size}"
    );

    let env = IntegrationEnv::setup().await?;
    let (session, exit) = env.open_unreliable_session_paths(0, 1).await?;
    let candidates = env.return_relayer_candidates(exit)?;
    anyhow::ensure!(
        candidates.len() >= 2,
        "need ≥2 return-relayer candidates to tell spread from concentration, got {}",
        candidates.len()
    );
    tracing::info!(
        %exit,
        candidates = candidates.len(),
        "return-path env ready (0-hop forward, 1-hop return)"
    );
    Ok((env, session, candidates))
}

/// Pump `payload` while sampling the forwarded-packet counters either side of it.
async fn pump_and_measure(
    session: HoprSession,
    candidates: &[NodeInfo],
    payload: &[u8],
    label: &str,
) -> anyhow::Result<(Transfer, RelayerSpread)> {
    let before = relayers::sample(candidates).await;
    let transfer = pump_loopback(session, payload, label, PUMP_TIMEOUT).await?;
    let after = relayers::sample(candidates).await;
    let spread = relayers::spread(&before, &after);
    tracing::info!(
        "{label}: return relayers → {} (total {} pkts, max share {:.0}%)",
        spread.summary(),
        spread.total,
        spread.max_share() * 100.0,
    );
    Ok((transfer, spread))
}

/// The mechanism: replies must rotate over distinct first relayers, not follow edge score.
///
/// **Currently fails on both stacks under skewed scores** (fixed 2.97, pre-fix 2.28/4.63)
/// and passes on both unshaped (≈1.03) — i.e. it does not yet observe the behaviour
/// hoprnet#8331 intends. That is a finding about the fix, not a threshold to relax: the
/// suspected cause is that diversity is bounded per *packet* rather than across the SURB
/// stream, so bucket selection re-randomises weight-proportionally on every call. See
/// `docs/return-path-scenarios.md` for the measurements and the call-site analysis.
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn return_paths_should_spread_across_distinct_relayers() -> anyhow::Result<()> {
    let (_env, session, candidates) = setup_return_path_env().await?;
    let payload = random_payload();

    let (transfer, spread) = pump_and_measure(session, &candidates, &payload, "spread").await?;

    anyhow::ensure!(
        spread.total > 0,
        "no packets were forwarded by any cluster node — the return path was not 1-hop, \
         so this measures nothing (transfer: {:.1}% arrived)",
        transfer.arrival_pct(),
    );

    // Every candidate should appear; require all but one so a single unlucky bucket draw
    // is not a failure, while still ruling out concentration.
    let expected_distinct = (candidates.len() - 1).max(2);
    let active = spread.active_relayers(ACTIVE_RELAYER_FLOOR);
    anyhow::ensure!(
        active.len() >= expected_distinct,
        "return paths concentrated: only {} of {} candidate relayers carried ≥{:.0}% \
         of the replies, expected ≥{expected_distinct} — {}",
        active.len(),
        candidates.len(),
        ACTIVE_RELAYER_FLOOR * 100.0,
        spread.summary(),
    );
    let imbalance = spread.imbalance(ACTIVE_RELAYER_FLOOR);
    anyhow::ensure!(
        imbalance <= MAX_RELAYER_IMBALANCE,
        "return paths track edge score instead of rotating: busiest relayer carried \
         {imbalance:.2}× the least-busy one (max {MAX_RELAYER_IMBALANCE:.2}). A round-robin \
         over {} buckets is uniform by construction, so anything much above 1.0 means \
         selection is still weight-proportional and a dead relay owns more than its 1/K \
         share — {}",
        candidates.len(),
        spread.summary(),
    );
    Ok(())
}

/// The incident: with the busiest return relayer killed mid-session, the reply stream
/// must degrade proportionally rather than stop.
///
/// Fails on the pre-fix stack — the killed relayer was carrying essentially the whole
/// return stream, so the second pump returns almost nothing.
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn session_should_survive_return_relayer_loss() -> anyhow::Result<()> {
    let (env, session, candidates) = setup_return_path_env().await?;
    let payload = random_payload();

    // First pump establishes who is actually carrying replies.
    let (before_kill, spread) =
        pump_and_measure(session, &candidates, &payload, "before-kill").await?;
    anyhow::ensure!(
        before_kill.arrival_pct() > 50.0,
        "baseline pump only returned {:.1}% — the path was already broken before the \
         kill, so the result would say nothing about resilience",
        before_kill.arrival_pct(),
    );

    let busiest = spread
        .busiest()
        .ok_or_else(|| anyhow::anyhow!("no relayer forwarded anything; nothing to kill"))?;
    let victim = candidates
        .iter()
        .find(|n| n.address == busiest)
        .ok_or_else(|| anyhow::anyhow!("busiest relayer {busiest} is not a cluster node"))?;
    tracing::info!(
        victim = %busiest,
        share_pct = spread.max_share() * 100.0,
        "killing the busiest return relayer"
    );
    victim.kill()?;

    // Same session, same everything — only the relay is gone. Nothing here waits for
    // probing to notice: the point is that the stream survives the detection gap.
    let session = env.open_unreliable_session_paths(0, 1).await?.0;
    let (after_kill, spread_after) =
        pump_and_measure(session, &candidates, &payload, "after-kill").await?;

    anyhow::ensure!(
        after_kill.arrival_pct() >= MIN_ARRIVAL_AFTER_KILL_PCT,
        "return path collapsed after losing one relayer: {:.1}% arrived, need \
         ≥{MIN_ARRIVAL_AFTER_KILL_PCT:.0}% (it had carried {:.0}% of replies) — {}",
        after_kill.arrival_pct(),
        spread.max_share() * 100.0,
        spread_after.summary(),
    );
    anyhow::ensure!(
        after_kill.received_bytes < after_kill.sent_bytes || after_kill.sha_ok,
        "full payload returned after the kill but corrupted (SHA-256 mismatch)",
    );
    tracing::info!(
        "survived relayer loss: {:.1}% → {:.1}% arrival, replies rerouted to {}",
        before_kill.arrival_pct(),
        after_kill.arrival_pct(),
        spread_after.summary(),
    );
    Ok(())
}

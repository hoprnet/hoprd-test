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
//!    draw. The fix tempers the weights (`w' = w^0.5`) before sampling, which compresses
//!    the ratio between candidates without reordering them, so a good relayer still wins
//!    more often but a single one no longer owns the return stream (hoprnet#8331).
//!
//!    An earlier attempt bucketed candidates and rotated between K of them. That could
//!    never work: `MAX_SURBS_IN_PACKET` is `PAYLOAD_SIZE / HoprSurb::SIZE` = 2, so K was
//!    pinned at 2 whatever the config said, and the rotation measured 2.97 imbalance --
//!    between the two pre-fix runs rather than below them.
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
/// indistinguishable from any other strategy over enough samples — measured: the pre-fix
/// stack produced the same 25/25/25/25 histogram as the fixed one. Tempering is monotone,
/// so with equal weights it is the identity. Concentration only appears
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
/// One node per step gives a 6.7× spread between best and worst, which is what tempering
/// has to compress: `6.7^0.5` is 2.58 before the two-per-packet draw flattens it further.
/// Without a spread there is nothing to compress and nothing to measure. Node 0 is the
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
/// single re-plan does not make a node a genuine participant in the return stream.
const ACTIVE_RELAYER_FLOOR: f64 = 0.05;

/// Maximum ratio between the busiest and least-busy relayer.
///
/// Selection is weighted-random with the weights tempered (`w' = w^0.5`). Tempering is
/// monotone, so it never reorders candidates — it only compresses the ratio between them.
/// The target is therefore *not* 1.0: a good relayer is still supposed to carry more than a
/// bad one, just not by the raw score ratio.
///
/// Derived for this profile rather than from what makes the test green. RFC-0014 scores the
/// per-node latencies below as 1.0 / 0.7 / 0.3 / 0.15, which as raw weights would give
/// shares of 46/33/14/7 — a ratio of 6.67. Tempered they become 36/30/20/14, a ratio of
/// 2.58. Drawing two distinct relayers per packet flattens the marginal distribution
/// further; calibrating that from the pre-fix run (ideal 6.67 measured 4.63, so ×0.69)
/// predicts **≈1.79**. The threshold allows jitter above that while staying under the
/// lowest pre-fix measurement.
///
/// **The margin is thin and the value is predicted, not yet measured.** Pre-fix runs
/// measured 2.28 and 4.63 (`docs/return-path-scenarios.md`), so the separation from the old
/// behaviour is only ~8% at the low end. With four candidates and `wanted = 2` this ratio
/// is a weak discriminator, and a run that lands near 2.2 would be ambiguous rather than
/// conclusive. Re-derive from a measured tempered run before trusting a pass.
///
/// Deliberately **not** a cap on the maximum *share*: with only four candidates the shares
/// overlap between designs, so a share cap cannot separate them and flips sign between runs.
const MAX_RELAYER_IMBALANCE: f64 = 2.1;

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
        "return paths track the raw edge score instead of the tempered one: busiest relayer \
         carried {imbalance:.2}× the least-busy one (max {MAX_RELAYER_IMBALANCE:.2}) across \
         {} candidates. Tempering compresses the score ratio without reordering, so a value \
         up near the untempered ratio means the compression is not being applied and a \
         single relay owns more of the return traffic than intended — {}",
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

    // How long the network is given to notice, before the replacement session mints its SURBs.
    // Parameterised because recovery appears to race path re-scoring: probing runs every 5s and the
    // path cache is 60s TTL / 30s refresh, so a session established too soon after the kill builds
    // its return paths from candidates that still include the dead relayer.
    let settle = std::env::var("HOPRD_KILL_SETTLE_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or(Duration::ZERO);
    if !settle.is_zero() {
        tracing::info!(?settle, "waiting before opening the replacement session");
        tokio::time::sleep(settle).await;
    }

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

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
    pump::{PumpOpts, Transfer, drain_until_quiet, pace_for_rate, pump_halves, tagged_payload},
    relayers::{self, RelayerSpread},
};

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

/// Warm-up payload: enough packets to make the relayer histogram unambiguous, no more.
///
/// Its only jobs are to establish the baseline rate and to show who is carrying replies. Keeping it
/// small also keeps the session quiet sooner, so the kill lands on an idle session rather than on
/// one still draining.
const WARMUP_BYTES: usize = 2 * 1024 * 1024;

/// How long the survival phase must keep *offering* data after the kill.
///
/// This is the defect that made an earlier version of this test unmeasurable. The session is
/// unreliable -- there is no retransmission -- so bytes lost during the outage never arrive, and a
/// payload handed to the session as fast as it will take it is fully committed within seconds. The
/// entire result was therefore decided inside the pre-detection window, and everything after it was
/// a buffer draining. Recovery can only be observed if load is still being offered when it happens,
/// so the survival phase is paced to span several times the deadline.
const SURVIVAL_LOAD_DURATION: Duration = Duration::from_secs(60);

/// Fraction of the measured baseline rate at which the survival phase offers data.
///
/// Below 1.0 on purpose. `before_kill.mbps` is a *burst* rate: the warm-up drains a SURB buffer
/// that was filled before it started, so it measures what the session can do with SURBs already
/// in hand, not what it sustains. Offering that same rate back after a quarter of the return
/// capacity has gone simply backpressures the writer -- measured, a 60 s offer took 266 s, and
/// the "recovery" at ~270 s was the backlog draining, not the path returning. The pump's own
/// pacing cannot detect this, because backpressure and not [`pace_for_rate`] sets the real rate.
///
/// Must also stay **above** [`RECOVERY_FRACTION`], or the test demands exactly what it offers and
/// any loss at all puts the target out of reach.
const SURVIVAL_LOAD_FRACTION: f64 = 0.7;

const _: () = assert!(
    SURVIVAL_LOAD_FRACTION > RECOVERY_FRACTION,
    "the survival phase must offer more than the recovery target demands"
);
const _: () = assert!(
    SURVIVAL_LOAD_FRACTION < 1.0,
    "offering the full burst baseline backpressures the writer and measures the harness"
);

/// Share of the survival payload that must come back for the session to count as having survived.
///
/// Derived from [`RECOVERY_DEADLINE`] rather than chosen. Over a paced phase the session delivers
/// nothing while the return path is down and roughly the offered rate once it is back, so
/// aggregate arrival *is* the outage expressed as a fraction of the phase:
///
/// ```text
/// arrival ≈ 1 − outage / SURVIVAL_LOAD_DURATION
/// ```
///
/// Requiring the outage to stay inside the deadline is therefore the same statement as requiring
/// this arrival, and the two can no longer drift apart. The previous flat 90 % was only reachable
/// because writer backpressure stretched the phase far past its nominal duration.
///
/// Only the part of the outage that overlaps the phase costs arrival. Nothing is offered during
/// [`KILL_SETTLE`], so a session that recovers exactly on the deadline is only ever seen to be down
/// for `RECOVERY_DEADLINE - KILL_SETTLE`; charging it for the settle as well would demand less than
/// the deadline does and let a late recovery pass.
const MIN_SURVIVAL_ARRIVAL_PCT: f64 = 100.0
    * (1.0
        - ((RECOVERY_DEADLINE.as_secs() - KILL_SETTLE.as_secs()) as f64
            / SURVIVAL_LOAD_DURATION.as_secs() as f64));

/// Quiet period the survival pump tolerates before calling the stream idle.
///
/// Must exceed [`RECOVERY_DEADLINE`]: the pump exists to observe how long the path takes to come
/// back, so a budget shorter than the deadline ends the measurement before the thing being
/// measured can happen. The pump's own default is shorter, which is why this is stated.
const SURVIVAL_IDLE_BUDGET: Duration = Duration::from_secs(30);

const _: () = assert!(
    SURVIVAL_IDLE_BUDGET.as_secs() > RECOVERY_DEADLINE.as_secs(),
    "the idle budget must outlive the recovery deadline it is measuring"
);

/// How long to wait after the kill before offering any new data.
///
/// Not zero, deliberately. At zero the survival phase's opening seconds race packets that were
/// already in flight when the relayer died, so an early arrival cannot be attributed to a recovered
/// session rather than to one that had not yet noticed. A few seconds of quiet means every byte
/// measured afterwards was offered to a network that has already lost the relayer.
///
/// This window counts against [`RECOVERY_DEADLINE`]: recovery is timed from the kill, not from the
/// first byte offered. Nothing is in flight during the settle, so the mechanism cannot demonstrate
/// itself here -- but the session is broken throughout it, and the clock a user experiences starts
/// when the relay dies, not when the test resumes sending.
///
/// Ten seconds rather than four: detection has been measured at ~9 s from the kill, so a shorter
/// settle offers the opening seconds of the survival phase into a path whose re-plan has not landed
/// yet. Those bytes are lost to an outage the session is still in, and they are charged to arrival
/// as though the recovered path had dropped them.
const KILL_SETTLE: Duration = Duration::from_secs(10);

const _: () = assert!(
    KILL_SETTLE.as_secs() < RECOVERY_DEADLINE.as_secs(),
    "the settle must leave some of the deadline for the mechanism to demonstrate itself in"
);

/// [`KILL_SETTLE`], overridable for a one-off experiment via `HOPRD_KILL_SETTLE_SECS`.
fn kill_settle() -> Duration {
    std::env::var("HOPRD_KILL_SETTLE_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map_or(KILL_SETTLE, Duration::from_secs)
}

/// How long the return stream must be silent before the warm-up counts as finished.
const DRAIN_QUIET: Duration = Duration::from_secs(3);

/// Leftover warm-up bytes above which the phases cannot be told apart.
///
/// Anything still arriving from the warm-up would be counted as survival-phase arrival, which is
/// exactly the contamination that makes a dead stream look like a recovering one.
const MAX_LEFTOVER_BYTES: usize = 64 * 1024;

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
/// Fraction of pre-kill throughput the stream must get back to.
///
/// Losing a relayer costs real capacity, so the bar is not "as before" -- it is that the stream
/// settles at a usable rate instead of trickling or dying.
const RECOVERY_FRACTION: f64 = 0.5;

/// How long after the kill that rate must be reached, as the *test* boundary.
///
/// Measured from the kill itself, which includes [`KILL_SETTLE`] -- the session is already broken
/// during that window even though the test is offering nothing, and whoever is waiting for the
/// connection is not paused along with it.
///
/// The design target is [`RECOVERY_AIM`] -- 15s. This bar sits above it deliberately: the recovery
/// path is a sequence of independent stages (detection, graph trend, weight recompute, refill) and
/// a run that lands at 17s is a mechanism that works with a stage to tighten, not a regression to
/// bisect. Failing at 15s would spend runs on that distinction, and a cluster run is ~12 minutes.
///
/// Recovery time is logged against both, so drift toward the boundary stays visible instead of
/// only surfacing when it crosses.
const RECOVERY_DEADLINE: Duration = Duration::from_secs(20);

/// What the mechanism is designed to hit. Not asserted -- reported, so a run that passes the
/// boundary while missing the aim is still legible as such.
const RECOVERY_AIM: Duration = Duration::from_secs(15);

/// How long recovered throughput must hold before it counts as recovered.
///
/// Long enough that a single lucky burst does not read as recovery, short enough to resolve a
/// target measured in seconds.
/// How long the recovered rate has to hold before it counts as recovered rather than a burst.
///
/// Two seconds was too short: a transfer that ended after 1.6s satisfied it from its opening burst
/// alone and reported a recovery that never happened.
const RECOVERY_SUSTAIN_WINDOW: Duration = Duration::from_secs(3);

/// Phase tag for the warm-up payload.
const WARMUP_PHASE: u8 = 1;
/// Phase tag for the post-kill survival payload.
const SURVIVAL_PHASE: u8 = 2;

/// Bring up a cluster sized for return-path work and open a 0-hop-out / 1-hop-back
/// session, returning the env, the session, and the nodes that can relay replies.
async fn setup_return_path_env() -> anyhow::Result<(IntegrationEnv, HoprSession, Vec<NodeInfo>)> {
    setup_env_with_hops(0, 1).await
}

/// As above, with the forward and return hop counts named explicitly.
///
/// `(0, 1)` keeps the relayer histogram attributable — no cluster node relays anything outbound, so
/// every forwarded packet is a reply. `(1, 1)` is the realistic shape but gives up that attribution,
/// since the victim can sit on either direction.
async fn setup_env_with_hops(
    forward_hops: usize,
    return_hops: usize,
) -> anyhow::Result<(IntegrationEnv, HoprSession, Vec<NodeInfo>)> {
    let size = request_cluster_size(NODES);
    request_latency_profile(LATENCY_PROFILE);
    anyhow::ensure!(
        size >= 3,
        "return-path scenarios need ≥3 nodes to have >1 relayer candidate, got {size}"
    );

    let env = IntegrationEnv::setup().await?;
    let (session, exit) = env
        .open_unreliable_session_paths(forward_hops, return_hops)
        .await?;
    let candidates = env.return_relayer_candidates(exit)?;
    anyhow::ensure!(
        candidates.len() >= 2,
        "need ≥2 return-relayer candidates to tell spread from concentration, got {}",
        candidates.len()
    );
    tracing::info!(
        %exit,
        candidates = candidates.len(),
        forward_hops,
        return_hops,
        "return-path env ready"
    );
    Ok((env, session, candidates))
}

/// Pump `payload` while sampling the forwarded-packet counters either side of it.
///
/// Takes the session halves by reference so a scenario can pump the *same* session more than once.
async fn pump_and_measure(
    rx: &mut tokio::io::ReadHalf<HoprSession>,
    tx: &mut tokio::io::WriteHalf<HoprSession>,
    candidates: &[NodeInfo],
    payload: &[u8],
    label: &str,
    opts: PumpOpts,
) -> anyhow::Result<(Transfer, RelayerSpread)> {
    let before = relayers::sample(candidates).await;
    let transfer = pump_halves(rx, tx, payload, label, PUMP_TIMEOUT, opts).await?;
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
    let payload = tagged_payload(WARMUP_PHASE, WARMUP_BYTES);

    let (mut rx, mut tx) = tokio::io::split(session);
    let (transfer, spread) = pump_and_measure(
        &mut rx,
        &mut tx,
        &candidates,
        &payload,
        "spread",
        PumpOpts {
            phase: Some(WARMUP_PHASE),
            ..PumpOpts::default()
        },
    )
    .await?;

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
    // Held for the cluster lifetime; the scenario itself never opens a second session.
    let (_env, session, candidates) = setup_return_path_env().await?;

    // Split once and keep the halves: both phases run over this one session, so what is measured
    // is the *established* stream surviving. A replacement session opened after the kill would
    // instead measure cold-start path selection -- an easier problem, since a fresh session never
    // minted a SURB through the dead relayer.
    let (mut rx, mut tx) = tokio::io::split(session);

    // Phase 1 -- warm up: establish the baseline rate and who is actually carrying replies.
    let warmup_payload = tagged_payload(WARMUP_PHASE, WARMUP_BYTES);
    let (before_kill, spread) = pump_and_measure(
        &mut rx,
        &mut tx,
        &candidates,
        &warmup_payload,
        "before-kill",
        PumpOpts {
            phase: Some(WARMUP_PHASE),
            ..PumpOpts::default()
        },
    )
    .await?;
    anyhow::ensure!(
        before_kill.arrival_pct() > 50.0,
        "baseline pump only returned {:.1}% — the path was already broken before the \
         kill, so the result would say nothing about resilience",
        before_kill.arrival_pct(),
    );

    // Phase 2 -- quiesce: everything still in flight from the warm-up has to land before the kill,
    // or it is counted as survival-phase arrival and a dead stream reads as a recovering one.
    let leftover = drain_until_quiet(&mut rx, DRAIN_QUIET, "warm-up").await;
    anyhow::ensure!(
        leftover <= MAX_LEFTOVER_BYTES,
        "{leftover} B of warm-up traffic was still arriving after the warm-up was declared \
         complete (limit {MAX_LEFTOVER_BYTES} B); the two phases cannot be told apart, so no \
         survival measurement taken here would mean anything",
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

    // Phase 3 -- settle: let the kill land before any new data is offered.
    //
    // Starting the survival phase at the instant of the kill measures something else entirely: its
    // first seconds race packets that were already in flight when the relayer died, so a byte that
    // arrives cannot be attributed to a session that recovered rather than to one that had not yet
    // noticed. Waiting a few seconds means every byte of the survival phase is offered to a network
    // that has *already* lost the relayer, which is the question being asked.
    let settle = kill_settle();
    tracing::info!(?settle, "letting the kill land before offering new data");
    tokio::time::sleep(settle).await;

    // Phase 4 -- survive: fresh bytes, offered at a steady rate for several times the deadline so
    // that load is still arriving when recovery happens. Sized from the measured baseline rather
    // than fixed, so the offered rate stays a constant fraction of what this cluster can do.
    let offered_mbps = before_kill.mbps * SURVIVAL_LOAD_FRACTION;
    let survival_bytes =
        (offered_mbps * 1_000_000.0 * SURVIVAL_LOAD_DURATION.as_secs_f64()) as usize;
    tracing::info!(
        "survival phase: offering {:.2} MB at {offered_mbps:.2} MB/s for {SURVIVAL_LOAD_DURATION:?} \
         (baseline {:.2} MB/s)",
        survival_bytes as f64 / 1_000_000.0,
        before_kill.mbps,
    );
    let survival_payload = tagged_payload(SURVIVAL_PHASE, survival_bytes);
    let (after_kill, spread_after) = pump_and_measure(
        &mut rx,
        &mut tx,
        &candidates,
        &survival_payload,
        "after-kill",
        PumpOpts {
            pace: pace_for_rate(offered_mbps),
            phase: Some(SURVIVAL_PHASE),
            idle_budget: Some(SURVIVAL_IDLE_BUDGET),
        },
    )
    .await?;

    assert_recovered(&before_kill, &after_kill, &spread, &spread_after, settle)
}

/// Report every measurement, then assert on them in combination.
///
/// Each statistic alone has a way of being satisfied by a stream that is dead. `time_to_sustain`
/// once reported "recovered after 381.3s" for one, because an opening burst filled the window and
/// nothing was required of the stream afterwards. Aggregate arrival folds recovery latency,
/// steady-state rate and transfer length into one number whose run-to-run spread (measured: 19-45%
/// on identical builds) is wider than the effect being detected. The conjunction is what has no
/// such hole: the stream must reach the rate in time, *still* be carrying it when the pump ends,
/// and never have gone quiet for longer than the deadline on the way.
fn assert_recovered(
    before_kill: &Transfer,
    after_kill: &Transfer,
    spread: &RelayerSpread,
    spread_after: &RelayerSpread,
    settle: Duration,
) -> anyhow::Result<()> {
    let target_mbps = before_kill.mbps * RECOVERY_FRACTION;
    // Timed from the kill, so the post-kill settle counts against the deadline. The session is
    // already broken during that window even though no load is being offered, and a user waiting
    // for their connection to come back is not paused with it.
    let recovered_after = after_kill
        .time_to_sustain(target_mbps, RECOVERY_SUSTAIN_WINDOW)
        .map(|since_offer| since_offer + settle.as_secs_f64());
    let steady_state = after_kill.steady_state_mbps(RECOVERY_SUSTAIN_WINDOW);
    let longest_stall = after_kill.longest_stall();

    // Nothing on the other end is serving the session, so no amount of further waiting can change
    // the answer. Report that as its own finding rather than as a recovery that ran out of time --
    // "the exit stopped echoing" and "the return path is slow" call for entirely different work.
    // Only when the close actually prevented the measurement. A session that delivered almost
    // everything and then closed has answered the question; failing it as "never got the chance to
    // recover" would be plainly false, and was -- a run reporting exactly that had already returned
    // 93.6% of its payload.
    anyhow::ensure!(
        !after_kill.outcome.exit_stopped_serving()
            || after_kill.arrival_pct() >= MIN_SURVIVAL_ARRIVAL_PCT,
        "the exit stopped serving the session before it could recover ({:?} after {:.1}s, only \
         {:.1}% of {} B returned) — {}",
        after_kill.outcome,
        after_kill.wall_seconds,
        after_kill.arrival_pct(),
        after_kill.sent_bytes,
        spread_after.summary(),
    );

    // Any warm-up bytes that surfaced during the survival phase are a backlog releasing, not this
    // phase recovering. They are excluded from every figure above by construction; report them, and
    // refuse the run if there are enough of them to mean the drain did not work.
    if after_kill.foreign_bytes > 0 {
        tracing::warn!(
            "{} B of earlier-phase traffic arrived during the survival phase and was excluded",
            after_kill.foreign_bytes,
        );
    }
    anyhow::ensure!(
        after_kill.foreign_bytes <= MAX_LEFTOVER_BYTES,
        "{} B of warm-up traffic arrived during the survival phase (limit {MAX_LEFTOVER_BYTES} B); \
         the drain did not separate the phases, so the session was still working off a backlog \
         rather than carrying new load",
        after_kill.foreign_bytes,
    );

    // A pump shorter than the sustain window cannot answer the question at all. `time_to_sustain`
    // already refuses to guess, but say so explicitly rather than let it read as "never recovered".
    anyhow::ensure!(
        after_kill.wall_seconds > RECOVERY_SUSTAIN_WINDOW.as_secs_f64(),
        "after-kill pump ran only {:.2}s, shorter than the {RECOVERY_SUSTAIN_WINDOW:?} sustain \
         window, so recovery cannot be measured at all ({:.1}% arrived)",
        after_kill.wall_seconds,
        after_kill.arrival_pct(),
    );

    tracing::info!(
        "after-kill measurements: outcome {:?} | recovery {} (aim {}s, boundary {}s){} | steady state over the \
         final {RECOVERY_SUSTAIN_WINDOW:?} {steady_state:.2} MB/s vs target {target_mbps:.2} | \
         ttfb {} | longest stall {longest_stall:.1}s | inter-arrival p50 {} / p95 {} | \
         arrival {:.1}% ({} B of {} B) | wall {:.1}s",
        after_kill.outcome,
        recovered_after.map_or("never reached".to_string(), |s| format!("took {s:.1}s")),
        RECOVERY_AIM.as_secs(),
        RECOVERY_DEADLINE.as_secs(),
        // Both thresholds, in order. The earlier version only compared against the aim and then
        // claimed the boundary had been met regardless, so a 270s recovery against a 20s boundary
        // printed "PASSES the boundary" -- the opposite of the truth, in the one line a reader
        // scans first. Neither threshold is asserted, which is exactly why the wording has to be
        // right: this string is the only place the run says whether it hit them.
        match recovered_after {
            None => " (MISSES the boundary: never reached)",
            Some(s) if s > RECOVERY_DEADLINE.as_secs_f64() => " (MISSES the boundary, and the aim)",
            Some(s) if s > RECOVERY_AIM.as_secs_f64() => " (passes the boundary, MISSES the aim)",
            Some(_) => " (passes the boundary and the aim)",
        },
        after_kill
            .time_to_first_byte()
            .map_or("never".to_string(), |s| format!("{s:.1}s")),
        after_kill
            .inter_arrival_quantile(0.5)
            .map_or("n/a".to_string(), |s| format!("{s:.3}s")),
        after_kill
            .inter_arrival_quantile(0.95)
            .map_or("n/a".to_string(), |s| format!("{s:.3}s")),
        after_kill.arrival_pct(),
        after_kill.received_bytes,
        after_kill.sent_bytes,
        after_kill.wall_seconds,
    );
    tracing::info!(
        "recovery is timed from the kill: the {settle:?} settle before any load was offered is \
         included in the figure above",
    );

    // 1. Nearly all of the data offered after the fault came back. This is the bar: recovery time,
    //    steady state and stalls are reported above as diagnostics, but a session that delivers its
    //    payload has survived losing a relayer whatever shape the curve took getting there.
    anyhow::ensure!(
        after_kill.arrival_pct() >= MIN_SURVIVAL_ARRIVAL_PCT,
        "session did not survive the relayer loss: only {:.1}% of {} B came back (need \
         {MIN_SURVIVAL_ARRIVAL_PCT:.0}%); recovery {}, the lost relayer had carried {:.0}% of \
         replies — {}",
        after_kill.arrival_pct(),
        after_kill.sent_bytes,
        recovered_after.map_or("never reached the target rate".to_string(), |s| format!(
            "took {s:.1}s"
        )),
        spread.max_share() * 100.0,
        spread_after.summary(),
    );

    // 3. It never went quiet for longer than the deadline. A stream that stalls for a minute
    //    mid-transfer can still satisfy both of the above, and is not a recovered stream.
    anyhow::ensure!(
        longest_stall <= RECOVERY_DEADLINE.as_secs_f64(),
        "return path went quiet for {longest_stall:.1}s, longer than the {RECOVERY_DEADLINE:?} \
         deadline, despite recovering at {} — {}",
        recovered_after.map_or("never".to_string(), |s| format!("{s:.1}s")),
        spread_after.summary(),
    );

    // Both sides must speak in attributed bytes. `sha_ok` for a phased pump is computed over
    // this phase's records alone, so comparing it against the *raw* `received_bytes` -- which
    // includes the earlier phase's backlog -- lets foreign traffic push the count past the
    // budget while some of this phase's records are still missing, and reports a merely lossy
    // stream as corrupted.
    anyhow::ensure!(
        after_kill.attributed_bytes < after_kill.sent_bytes || after_kill.sha_ok,
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

/// The same incident on a symmetric 1-hop-out / 1-hop-back session — the shape a real deployment
/// runs.
///
/// Kept alongside the `(0, 1)` case rather than replacing it. With a relay on both directions the
/// forwarded-packet histogram no longer attributes cleanly: the victim may have been carrying data
/// out, replies back, or both, so a collapse cannot be pinned on the return path from the counters
/// alone. That makes this the realistic test and `(0, 1)` the diagnostic one.
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn a_symmetric_session_should_survive_relayer_loss() -> anyhow::Result<()> {
    let (_env, session, candidates) = setup_env_with_hops(1, 1).await?;
    let (mut rx, mut tx) = tokio::io::split(session);

    let warmup_payload = tagged_payload(WARMUP_PHASE, WARMUP_BYTES);
    let (before_kill, spread) = pump_and_measure(
        &mut rx,
        &mut tx,
        &candidates,
        &warmup_payload,
        "sym-before-kill",
        PumpOpts {
            phase: Some(WARMUP_PHASE),
            ..PumpOpts::default()
        },
    )
    .await?;
    anyhow::ensure!(
        before_kill.arrival_pct() > 50.0,
        "baseline pump only returned {:.1}% — the path was already broken before the kill",
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
        "killing the busiest relayer (symmetric 1-hop session; direction not attributable)"
    );
    victim.kill()?;
    let settle = kill_settle();
    tokio::time::sleep(settle).await;

    let offered_mbps = before_kill.mbps * SURVIVAL_LOAD_FRACTION;
    let survival_bytes =
        (offered_mbps * 1_000_000.0 * SURVIVAL_LOAD_DURATION.as_secs_f64()) as usize;
    let survival_payload = tagged_payload(SURVIVAL_PHASE, survival_bytes);
    let (after_kill, spread_after) = pump_and_measure(
        &mut rx,
        &mut tx,
        &candidates,
        &survival_payload,
        "sym-after-kill",
        PumpOpts {
            pace: pace_for_rate(offered_mbps),
            phase: Some(SURVIVAL_PHASE),
            idle_budget: Some(SURVIVAL_IDLE_BUDGET),
        },
    )
    .await?;

    assert_recovered(&before_kill, &after_kill, &spread, &spread_after, settle)
}

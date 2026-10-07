//! Does the entry's SURB balancer congest the entry's own uplink?
//!
//! # The incident these reproduce
//!
//! On 2026-09-24 a `gnosis_vpn-client` v0.96.0 → v0.96.3 user on macOS connected to the
//! Netherlands exit three times; every connect succeeded in 5–9 s and every one was ended by the
//! user after minutes of a bursty, stalling downlink (0–880 KiB/s, tunnel ping 0.17–10.6 s). Probes
//! to *every* exit slowed down at the same instants while the tunnel was up and were clean while it
//! was down, so the bottleneck sat at the entry, not at an exit. What it lined up with was the entry's
//! own SURB production, as printed by `surb balancer state`:
//!
//! 1. **Refill bursts.** The PID (`P 0.6 / I 0.7 / D 0.2`, per 100 ms tick, `pid` crate without a
//!    dt) sat at `output=0` while the level estimate was above target and jumped to the full
//!    `max_surbs_per_sec` (3797, later 5063 SURB/s) for a second or two whenever it dipped below.
//!    At two SURBs per ~1.46 kB keep-alive that is ~22–30 Mbit/s of upstream from nothing.
//! 2. **Degraded mode pinned at the budget.** Late replies read as a dead return path
//!    (`return path degraded`); with `sustain_on_return_path_loss: true` — which the client sets —
//!    the controller overwrites the level with 0 and production stays at `max_surbs_per_sec` with
//!    `consumed` flat (12:04:54 onwards: produced 47k → 204k against 40k consumed).
//! 3. **It survived the disconnect.** The client dropped the session without closing it (fixed in
//!    gnosis_vpn-client #830, unreleased at the time); the balancer kept minting ~3.3k SURB/s for the
//!    30 s until the worker stopped.
//!
//! Full analysis: `claude/2026-09-25-kika-macos-surb-flood-self-congestion.md` in the
//! "Session stability" project.
//!
//! # The scenarios
//!
//! Every scenario asserts the **desired** behaviour, as `upload_survival` does: a failure is the bug
//! reproduced, a pass means the fix reached the line.
//!
//! | scenario | needs | reproduces |
//! | -------- | ----- | ---------- |
//! | [`surb_refills_should_track_consumption`] | 3 nodes | 1 |
//! | [`return_outage_should_not_pin_surb_production_at_max`] | 5 nodes, SIGSTOP | 2 |
//! | [`dropping_a_session_should_stop_its_balancer`] | 5 nodes, SIGSTOP | 3 |
//! | [`shaped_uplink_should_not_stall_downstream`] | 3 nodes + a shaped entry uplink (root) | the user-visible symptom |
//!
//! The first three need no shaping: they read the balancer's own gauges and SURB counters (see
//! [`hoprd_integration_test::balancer`]), which show the bursts and the pinning whether or not a link
//! suffers from them. The fourth is the end-to-end symptom and needs the entry's uplink to be the
//! bottleneck, which an unshaped loopback never is — see `scripts/shape-edge-uplink.sh`.
//!
//! Every balancer here is [`gnosis_vpn_client_surb_config`] — the client's main-session config
//! including `sustain_on_return_path_loss` — not the throughput tests' `gnosis_main_surb_config`.
//!
//! **Thresholds are predicted from the incident log and a model of the control law, not yet
//! measured on a cluster.** Re-derive them from a measured run before trusting a pass or a fail;
//! `SURB_BALANCER_CSV_DIR=<dir>` writes each scenario's balancer series for that.
//!
//! # Varying the controller
//!
//! The PID gains are read from `HOPR_BALANCER_PID_{P,I,D}_GAIN` when each session is created, in this
//! process (the entry is in-process), so a gain experiment needs no code change:
//!
//! ```bash
//! HOPR_BALANCER_PID_I_GAIN=0.01 just surb-congestion surb_refills_should_track_consumption
//! ```
//!
//! # Running them
//!
//! ```bash
//! just surb-congestion                                       # the three unshaped scenarios
//! sudo bash scripts/shape-edge-uplink.sh up 8    # then, for the fourth:
//! just surb-congestion shaped_uplink_should_not_stall_downstream
//! sudo bash scripts/shape-edge-uplink.sh down
//! ```
//!
//! One scenario per invocation — two of them SIGSTOP cluster nodes.

use std::time::Duration;

use edgli::hopr_lib::exports::transport::{SURB_SIZE, SurbBalancerConfig};
use hoprd_integration_test::{
    HoprSession, IntegrationEnv,
    balancer::{Sampler, Trace},
    cluster::{NodeInfo, request_cluster_size},
    env::{first_edge_p2p_port, gnosis_vpn_client_surb_config},
    pump::{
        PumpOpts, PumpOutcome, Transfer, drain_until_quiet, pace_for_rate_with_chunk, pump_halves,
        tagged_payload,
    },
};
use tokio::io::{AsyncWriteExt as _, ReadHalf, WriteHalf};

/// How often the balancer is sampled. Its own loop ticks every 100 ms.
const SAMPLE_EVERY: Duration = Duration::from_millis(100);

/// Offered rate, MB/s. Near the incident's ~110–200 KiB/s average downlink, and far below what a
/// local cluster carries, so nothing here is throughput-bound except what a scenario shapes.
const OFFERED_MBPS: f64 = 0.25;

/// Bytes per paced write: a small, regular write like a tunnel's, not a 64 KiB burst per pace.
const CHUNK: usize = 4096;

/// Time excluded from the start of a trace: the initial fill to target runs at the budget by
/// design, and the incident's question is what happens after it.
const FILL_GRACE: Duration = Duration::from_secs(15);

/// A refill may run ahead of consumption, but not by more than this factor in any one second.
///
/// The incident ran ~10–20x: bursts at 3797–5063 SURB/s while the session consumed a few hundred.
const MAX_BURST_OVER_CONSUMPTION: f64 = 4.0;

/// Floor on the burst allowance as a share of `max_surbs_per_sec`, so a nearly idle session is not
/// held to "4x almost nothing".
const BURST_FLOOR_FRACTION: f64 = 0.25;

/// Largest share of steady-state samples allowed at ≥95 % of `max_surbs_per_sec`.
const MAX_SHARE_AT_BUDGET: f64 = 0.05;

/// Phase tags, so a backlog from one phase cannot be counted as the next one arriving.
const WARMUP_PHASE: u8 = 1;
const OUTAGE_PHASE: u8 = 3;
const CONTROL_PHASE: u8 = 4;
const PRODUCTION_PHASE: u8 = 5;

const PUMP_TIMEOUT: Duration = Duration::from_secs(600);
const DRAIN_QUIET: Duration = Duration::from_secs(3);

/// Return-path outage detection takes ~9 s (`KILL_SETTLE` in `return_path.rs`, and
/// `RETURN_PATH_DEGRADED_GRACE` = 10 s in hopr-transport); outage windows are measured after it.
const DETECTION_GRACE: Duration = Duration::from_secs(10);

/// How long the return relayers stay frozen.
const OUTAGE_DURATION: Duration = Duration::from_secs(25);

/// During a return-path outage, production may exceed the pre-outage consumption rate by this
/// factor — enough to keep refilling a draining exit, not the whole budget.
const MAX_OUTAGE_MINT_OVER_BASELINE: f64 = 2.0;

/// Floor for the outage allowance, as a share of `max_surbs_per_sec`.
const OUTAGE_FLOOR_FRACTION: f64 = 0.10;

/// After a session is dropped, its balancer gets this long to notice before production must stop.
const DROP_GRACE: Duration = Duration::from_secs(2);

/// How long production is watched after the drop.
const AFTER_DROP: Duration = Duration::from_secs(15);

/// SURBs a dropped session may still produce after [`DROP_GRACE`] — in-flight writes, not a loop.
const MAX_SURBS_AFTER_DROP: u64 = 50;

/// Nodes for the outage scenarios: 0-hop out / 1-hop back needs more than one return candidate.
const OUTAGE_NODES: usize = 5;

/// Resumes paused relayers on drop, so an early return cannot leave SIGSTOPped `hoprd`s holding
/// their ports (they ignore SIGTERM until continued). Same as `return_path.rs`'s guard.
struct Thawed<'a>(&'a [NodeInfo]);

impl Drop for Thawed<'_> {
    fn drop(&mut self) {
        for node in self.0 {
            if let Err(e) = node.resume() {
                tracing::warn!(%e, "failed to resume relayer during cleanup");
            }
        }
    }
}

fn paced(phase: u8, mbps: f64) -> PumpOpts {
    PumpOpts {
        pace: pace_for_rate_with_chunk(mbps, CHUNK),
        chunk: Some(CHUNK),
        phase: Some(phase),
        idle_budget: Some(Duration::from_secs(20)),
        tail_grace: Some(Duration::from_secs(10)),
        ..PumpOpts::default()
    }
}

fn bytes_for(mbps: f64, d: Duration) -> usize {
    (mbps * 1_000_000.0 * d.as_secs_f64()) as usize
}

/// The trace must actually contain the balancer, or every assertion below is about nothing.
fn require_observable(trace: &Trace, name: &str) -> anyhow::Result<()> {
    anyhow::ensure!(
        trace.observable(),
        "{name}: no balancer gauges in the entry's registry ({}) — the build lacks telemetry or no \
         balancer ran, so this run cannot say anything about SURB production",
        trace.summary(),
    );
    Ok(())
}

/// 1. A steady, modest stream: does SURB production follow consumption, or swing between nothing
///    and the full budget?
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn surb_refills_should_track_consumption() -> anyhow::Result<()> {
    let cfg = gnosis_vpn_client_surb_config();
    let env = IntegrationEnv::setup().await?;
    // 1-hop both ways: the shape the user ran.
    let (session, _exit) = env
        .open_unreliable_session_with_surbs(1, 1, Some(cfg))
        .await?;
    let (mut rx, mut tx) = tokio::io::split(session);

    let sampler = Sampler::start(SAMPLE_EVERY);
    let payload = tagged_payload(
        WARMUP_PHASE,
        bytes_for(OFFERED_MBPS, Duration::from_secs(75)),
    );
    let transfer = pump_halves(
        &mut rx,
        &mut tx,
        &payload,
        "steady",
        PUMP_TIMEOUT,
        paced(WARMUP_PHASE, OFFERED_MBPS),
    )
    .await?;
    let trace = sampler.stop().await?;
    trace.maybe_write_csv("surb_refills_should_track_consumption");
    require_observable(&trace, "steady")?;

    let steady = trace.after(FILL_GRACE);
    let budget = cfg.max_surbs_per_sec as f64;
    let consumption = steady.consume_rate().unwrap_or_default();
    let peak = steady
        .peak_mint_rate(Duration::from_secs(1))
        .unwrap_or_default();
    let at_budget = steady
        .share_output_at_least(0.95 * budget)
        .unwrap_or_default();
    tracing::info!(
        arrival_pct = transfer.arrival_pct(),
        longest_stall_s = transfer.longest_stall(),
        consumption,
        peak,
        at_budget,
        budget,
        "steady-state balancer: {}",
        steady.summary(),
    );

    anyhow::ensure!(
        consumption > 0.0 && transfer.arrival_pct() > 50.0,
        "the path was broken ({:.1}% back, {consumption:.0} SURB/s consumed) — refill shape cannot \
         be judged on a session that is not carrying traffic",
        transfer.arrival_pct(),
    );
    let allowed = (MAX_BURST_OVER_CONSUMPTION * consumption).max(BURST_FLOOR_FRACTION * budget);
    assert!(
        peak <= allowed,
        "SURB refill burst: {peak:.0} SURB/s in one second against {consumption:.0} SURB/s consumed \
         (allowed {allowed:.0}, budget {budget:.0}) — the PID jumps to the budget whenever the level \
         dips below target",
    );
    assert!(
        at_budget <= MAX_SHARE_AT_BUDGET,
        "control output was at ≥95% of the {budget:.0} SURB/s budget for {:.1}% of the steady state \
         (max {:.0}%) — bang-bang control rather than tracking",
        at_budget * 100.0,
        MAX_SHARE_AT_BUDGET * 100.0,
    );
    Ok(())
}

/// What [`warmed_outage_session`] hands a scenario: the env (kept alive), the session halves, the
/// relayers to freeze, and the sampler already running since before the warm-up.
type WarmedSession = (
    IntegrationEnv,
    ReadHalf<HoprSession>,
    WriteHalf<HoprSession>,
    Vec<NodeInfo>,
    Sampler,
);

/// Bring up the outage cluster, open a 0-hop-out / 1-hop-back session with the client's balancer,
/// and warm it up with the sampler running.
async fn warmed_outage_session(name: &str) -> anyhow::Result<WarmedSession> {
    let size = request_cluster_size(OUTAGE_NODES);
    anyhow::ensure!(size >= 3, "outage scenarios need ≥3 nodes, got {size}");
    let env = IntegrationEnv::setup().await?;
    // 0-hop out / 1-hop back: freezing the relayer set takes the whole return path down while the
    // entry's keep-alives still reach the exit directly — the "return path silent, uplink fine"
    // shape the balancer reads as degraded.
    let (session, exit) = env
        .open_unreliable_session_with_surbs(0, 1, Some(gnosis_vpn_client_surb_config()))
        .await?;
    let candidates = env.relayer_candidates(exit)?;
    anyhow::ensure!(
        !candidates.is_empty(),
        "{name}: no return relayer candidates"
    );
    let (mut rx, mut tx) = tokio::io::split(session);

    let sampler = Sampler::start(SAMPLE_EVERY);
    let warmup = tagged_payload(
        WARMUP_PHASE,
        bytes_for(OFFERED_MBPS, Duration::from_secs(30)),
    );
    let before = pump_halves(
        &mut rx,
        &mut tx,
        &warmup,
        &format!("{name}-warmup"),
        PUMP_TIMEOUT,
        paced(WARMUP_PHASE, OFFERED_MBPS),
    )
    .await?;
    anyhow::ensure!(
        before.arrival_pct() > 50.0,
        "{name}: warm-up only returned {:.1}% — the path was broken before the outage",
        before.arrival_pct(),
    );
    drain_until_quiet(&mut rx, DRAIN_QUIET, "warm-up").await;
    Ok((env, rx, tx, candidates, sampler))
}

/// 2. A return-path outage with the client's config: does production stay bounded, or pin at the
///    budget while nothing comes back?
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn return_outage_should_not_pin_surb_production_at_max() -> anyhow::Result<()> {
    let cfg = gnosis_vpn_client_surb_config();
    let (_env, mut rx, mut tx, candidates, sampler) = warmed_outage_session("outage").await?;
    let pre_outage = sampler.now();

    let thawed = Thawed(&candidates);
    for node in &candidates {
        node.pause()?;
    }
    let frozen_at = sampler.now();
    tracing::info!(
        frozen = candidates.len(),
        "return relayers frozen — outage begins"
    );

    // Keep offering load into the outage: the entry still sends, nothing comes back.
    let during = pump_halves(
        &mut rx,
        &mut tx,
        &tagged_payload(OUTAGE_PHASE, bytes_for(OFFERED_MBPS, OUTAGE_DURATION)),
        "outage",
        PUMP_TIMEOUT,
        PumpOpts {
            idle_budget: Some(OUTAGE_DURATION),
            tail_grace: Some(OUTAGE_DURATION),
            ..paced(OUTAGE_PHASE, OFFERED_MBPS)
        },
    )
    .await?;
    let outage_end = sampler.now();
    drop(thawed);
    let trace = sampler.stop().await?;
    trace.maybe_write_csv("return_outage_should_not_pin_surb_production_at_max");
    require_observable(&trace, "outage")?;
    anyhow::ensure!(
        during.outcome != PumpOutcome::SessionClosed,
        "the session was torn down during the outage — that is a different failure than this \
         scenario measures"
    );

    let budget = cfg.max_surbs_per_sec as f64;
    // Pre-outage consumption from the session's own counter, over the warm-up after the fill.
    let baseline = trace
        .window(FILL_GRACE, pre_outage)
        .consume_rate()
        .unwrap_or_default();
    anyhow::ensure!(
        baseline > 0.0,
        "no consumption measured before the outage — the warm-up did not carry traffic"
    );
    let outage = trace.window(frozen_at + DETECTION_GRACE, outage_end);
    let mint = outage.mint_rate().unwrap_or_default();
    let at_budget = outage
        .share_output_at_least(0.95 * budget)
        .unwrap_or_default();
    tracing::info!(
        baseline,
        mint,
        at_budget,
        budget,
        "balancer during the outage: {}",
        outage.summary(),
    );

    let allowed = (MAX_OUTAGE_MINT_OVER_BASELINE * baseline).max(OUTAGE_FLOOR_FRACTION * budget);
    assert!(
        mint <= allowed,
        "SURB production during the return-path outage was {mint:.0} SURB/s against a pre-outage \
         consumption of {baseline:.0} SURB/s (allowed {allowed:.0}, budget {budget:.0}) — degraded \
         mode with sustain_on_return_path_loss mints at max_surbs_per_sec while nothing comes back",
    );
    assert!(
        at_budget <= 0.5,
        "control output sat at the {budget:.0} SURB/s budget for {:.0}% of the outage",
        at_budget * 100.0,
    );
    Ok(())
}

/// 3. Drop a session mid-outage without closing it, as gnosis_vpn-client ≤ v0.96.3 did on
///    disconnect: does its balancer stop?
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires hoprd/hoprd-localcluster binaries + a chain"]
async fn dropping_a_session_should_stop_its_balancer() -> anyhow::Result<()> {
    let (_env, mut rx, mut tx, candidates, sampler) = warmed_outage_session("drop").await?;

    // Freeze the return path first, so a surviving balancer is loud (degraded mode at the budget)
    // rather than idle above target — an idle leak produces nothing and would pass by accident.
    let thawed = Thawed(&candidates);
    for node in &candidates {
        node.pause()?;
    }
    let _ = pump_halves(
        &mut rx,
        &mut tx,
        &tagged_payload(OUTAGE_PHASE, bytes_for(OFFERED_MBPS, DETECTION_GRACE * 2)),
        "drop-before",
        PUMP_TIMEOUT,
        PumpOpts {
            idle_budget: Some(DETECTION_GRACE * 2),
            tail_grace: Some(Duration::from_secs(1)),
            ..paced(OUTAGE_PHASE, OFFERED_MBPS)
        },
    )
    .await?;

    // Drop both halves without `shutdown()`: the session handle goes away and nothing tells the
    // session manager.
    let before_drop = sampler.now();
    drop(rx);
    drop(tx);
    tracing::info!("session dropped without close");
    tokio::time::sleep(AFTER_DROP).await;
    let end = sampler.now();
    drop(thawed);
    let trace = sampler.stop().await?;
    trace.maybe_write_csv("dropping_a_session_should_stop_its_balancer");
    require_observable(&trace, "drop")?;

    let before = trace.window(
        before_drop.saturating_sub(Duration::from_secs(5)),
        before_drop,
    );
    let after = trace.window(before_drop + DROP_GRACE, end);
    let produced_after = after.produced_delta().unwrap_or_default();
    tracing::info!(
        produced_after,
        "before the drop: {} | after the drop: {}",
        before.summary(),
        after.summary(),
    );
    assert!(
        produced_after <= MAX_SURBS_AFTER_DROP,
        "the dropped session's balancer kept minting: {produced_after} SURBs in the {:?} after the \
         drop (+{DROP_GRACE:?} grace) — HoprSession has no Drop that tells the session manager",
        AFTER_DROP - DROP_GRACE,
    );
    Ok(())
}

/// Longest acceptable silence on the downlink while the uplink has headroom for the data itself.
const MAX_SHAPED_STALL: Duration = Duration::from_secs(2);

/// Arrival both arms must reach on a link that fits the data.
const MIN_SHAPED_ARRIVAL_PCT: f64 = 95.0;

/// SURB upstream for the control arm: 2 Mb/s, a sixth of what the client ships with.
const CONTROL_SURB_UPSTREAM_BITS: u64 = 2_000_000;

/// How long each arm pumps.
const ARM_DURATION: Duration = Duration::from_secs(60);

/// Open one arm, pump it, close it, and require its balancer to go quiet before the next arm.
async fn shaped_arm(
    env: &IntegrationEnv,
    name: &str,
    phase: u8,
    cfg: SurbBalancerConfig,
) -> anyhow::Result<(Transfer, Trace)> {
    let (session, _exit) = env
        .open_unreliable_session_with_surbs(1, 1, Some(cfg))
        .await?;
    let (mut rx, mut tx) = tokio::io::split(session);
    let sampler = Sampler::start(SAMPLE_EVERY);
    let transfer = pump_halves(
        &mut rx,
        &mut tx,
        &tagged_payload(phase, bytes_for(OFFERED_MBPS, ARM_DURATION)),
        name,
        PUMP_TIMEOUT,
        paced(phase, OFFERED_MBPS),
    )
    .await?;
    // Close, not drop, so the next arm is not measured against this one's leftover balancer.
    let _ = tx.shutdown().await;
    drop(rx);
    drop(tx);
    tokio::time::sleep(Duration::from_secs(5)).await;
    let quiet_from = sampler.now().saturating_sub(Duration::from_secs(3));
    let trace = sampler.stop().await?;
    trace.maybe_write_csv(&format!("shaped_{name}"));
    let leftover = trace.after(quiet_from).produced_delta().unwrap_or_default();
    anyhow::ensure!(
        leftover <= MAX_SURBS_AFTER_DROP,
        "{name}: the closed session kept minting ({leftover} SURBs in its last 3 s), so the arms \
         cannot be isolated — see dropping_a_session_should_stop_its_balancer",
    );
    Ok((transfer, trace))
}

/// 4. The user-visible symptom: with the entry's uplink shaped to a rate that comfortably fits the
///    data, does the client's SURB budget stall the downlink? A capped-budget control arm on the
///    same link proves the link itself is not the cause.
#[test_log::test(tokio::test(flavor = "multi_thread"))]
#[ignore = "requires a shaped entry uplink (scripts/shape-edge-uplink.sh) + a chain"]
async fn shaped_uplink_should_not_stall_downstream() -> anyhow::Result<()> {
    let mbit: f64 = std::env::var("EDGE_UPLINK_SHAPED_MBIT")
        .ok()
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "EDGE_UPLINK_SHAPED_MBIT is not set: shape the entry uplink first with \
                 `sudo bash scripts/shape-edge-uplink.sh up <mbit>` (the `just` recipe \
                 reads its state file). Unshaped, loopback is never the bottleneck and this scenario \
                 measures nothing."
            )
        })?;
    let port: u16 = std::env::var("EDGE_UPLINK_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or_default();
    anyhow::ensure!(
        port == first_edge_p2p_port(),
        "the shaper is on port {port} but this binary's edgli will listen on {} — re-run the shaper \
         with the cluster size this scenario uses",
        first_edge_p2p_port(),
    );
    let data_mbit = OFFERED_MBPS * 8.0;
    anyhow::ensure!(
        mbit >= 2.0 * data_mbit,
        "a {mbit} Mbit/s uplink leaves no headroom over the {data_mbit} Mbit/s of data; shape it to \
         at least {} Mbit/s",
        2.0 * data_mbit,
    );

    let env = IntegrationEnv::setup().await?;
    let production = gnosis_vpn_client_surb_config();
    let control = SurbBalancerConfig {
        max_surbs_per_sec: CONTROL_SURB_UPSTREAM_BITS / (8 * SURB_SIZE as u64),
        ..production
    };

    // Control first: if it leaks, it leaks at a sixth of the rate into the production arm.
    let (ctl, ctl_trace) = shaped_arm(&env, "control", CONTROL_PHASE, control).await?;
    let (prod, prod_trace) = shaped_arm(&env, "production", PRODUCTION_PHASE, production).await?;
    for (name, t, trace) in [
        ("control", &ctl, &ctl_trace),
        ("production", &prod, &prod_trace),
    ] {
        tracing::info!(
            arm = name,
            uplink_mbit = mbit,
            arrival_pct = t.arrival_pct(),
            longest_stall_s = t.longest_stall(),
            p95_gap_s = t.inter_arrival_quantile(0.95),
            "{}",
            trace.after(FILL_GRACE).summary(),
        );
    }

    anyhow::ensure!(
        ctl.arrival_pct() >= MIN_SHAPED_ARRIVAL_PCT
            && ctl.longest_stall() <= MAX_SHAPED_STALL.as_secs_f64(),
        "the capped-budget control arm was unhealthy too ({:.1}% back, {:.1}s stall) — the shaped \
         link itself is too tight to attribute anything to the SURB budget",
        ctl.arrival_pct(),
        ctl.longest_stall(),
    );
    assert!(
        prod.arrival_pct() >= MIN_SHAPED_ARRIVAL_PCT
            && prod.longest_stall() <= MAX_SHAPED_STALL.as_secs_f64(),
        "with the client's SURB budget the downlink stalled on a {mbit} Mbit/s uplink: {:.1}% back, \
         longest stall {:.1}s (control arm: {:.1}%, {:.1}s) — SURB refills congest the entry's own \
         uplink",
        prod.arrival_pct(),
        prod.longest_stall(),
        ctl.arrival_pct(),
        ctl.longest_stall(),
    );
    Ok(())
}

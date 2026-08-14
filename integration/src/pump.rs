//! Reusable data-pump building block for scenarios.

use std::time::Duration;

use edgli::hopr_lib::exports::transport::HoprSession;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Received throughput in KiB/s over `elapsed`.
fn throughput_kibs(bytes: usize, elapsed: Duration) -> f64 {
    (bytes as f64 / 1024.0) / elapsed.as_secs_f64().max(1e-9)
}

/// Why the reader stopped.
///
/// A transfer that returned nothing and a transfer that ran slowly are different findings, and a
/// bare timeout cannot tell them apart. Naming the reason is what lets a scenario fail immediately
/// on "the exit stopped serving" instead of waiting out a deadline that can no longer teach it
/// anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PumpOutcome {
    /// The whole payload came back.
    Complete,
    /// Bytes arrived and then the return stream went quiet for [`READ_IDLE_TIMEOUT`].
    Idle,
    /// Nothing ever came back within [`NO_FIRST_BYTE_TIMEOUT`].
    NeverStarted,
    /// The session reported end-of-stream — the counterparty stopped serving it.
    SessionClosed,
    /// The overall deadline expired while the stream was still delivering.
    DeadlineExceeded,
}

impl PumpOutcome {
    /// Whether the counterparty stopped serving the session, as opposed to serving it badly.
    ///
    /// Both of these mean no further waiting can change the answer: there is nothing on the other
    /// end to recover.
    pub fn exit_stopped_serving(&self) -> bool {
        matches!(self, Self::NeverStarted | Self::SessionClosed)
    }
}

/// Result of one loopback round-trip.
#[derive(Debug, Clone)]
pub struct Transfer {
    /// Why the reader stopped.
    pub outcome: PumpOutcome,
    pub sent_bytes: usize,
    pub received_bytes: usize,
    /// Wall-clock from first byte written to last byte read back.
    pub seconds: f64,
    /// Goodput = received_bytes / seconds, in MB/s.
    pub mbps: f64,
    /// True only when the full payload returned intact (received == sent and bytes match).
    pub sha_ok: bool,
    /// Wall-clock from the moment the pump started to the moment the reader stopped.
    ///
    /// Distinct from [`Self::seconds`], which spans first byte to last: the difference between the
    /// two is exactly the time a recovering stream spent delivering nothing, which is the interval
    /// a recovery deadline is about.
    pub wall_seconds: f64,
    /// `(seconds since the *pump started*, cumulative bytes received)`, one per read.
    ///
    /// Aggregate arrival cannot express *when* a transfer recovered — it folds recovery latency,
    /// steady-state rate and timeout behaviour into a single number whose run-to-run spread is
    /// wider than the effects worth measuring. The series keeps the shape so recovery can be read
    /// off it directly.
    ///
    /// Stamped from the pump start rather than the first arrival, so a stream that delivered
    /// nothing for its first 12 s cannot report that it recovered at t=0.
    pub progress: Vec<(f64, usize)>,
}

impl Transfer {
    /// Percent of sent bytes that returned.
    pub fn arrival_pct(&self) -> f64 {
        (self.received_bytes as f64) / (self.sent_bytes.max(1) as f64) * 100.0
    }

    /// Seconds from the start of the pump to the first byte back, `None` if none ever arrived.
    pub fn time_to_first_byte(&self) -> Option<f64> {
        self.progress.first().map(|&(at, _)| at)
    }

    /// The longest interval in which no bytes arrived.
    ///
    /// Counts the wait for the first byte and the tail after the last one, not merely the gaps
    /// between arrivals: a stream that delivered a burst and then died has its worst stall
    /// entirely in that tail, and a measure that ignored it would call the burst healthy.
    pub fn longest_stall(&self) -> f64 {
        let mut previous = 0.0;
        let mut worst: f64 = 0.0;
        for &(at, _) in &self.progress {
            worst = worst.max(at - previous);
            previous = at;
        }
        worst.max(self.wall_seconds - previous)
    }

    /// Gap between consecutive arrivals at quantile `q`, `None` with fewer than two arrivals.
    ///
    /// The pair p50/p95 separates a stream that is merely slow (both rise together) from one that
    /// is stuttering (p50 stays low while p95 blows out) — a distinction that mean throughput
    /// cannot make.
    pub fn inter_arrival_quantile(&self, q: f64) -> Option<f64> {
        if self.progress.len() < 2 {
            return None;
        }
        let mut gaps: Vec<f64> = self.progress.windows(2).map(|w| w[1].0 - w[0].0).collect();
        gaps.sort_by(|a, b| a.partial_cmp(b).expect("arrival timestamps are never NaN"));
        let index = (((gaps.len() - 1) as f64) * q.clamp(0.0, 1.0)).round() as usize;
        gaps.get(index).copied()
    }

    /// Throughput over the final `window` of the pump, in MB/s.
    ///
    /// Anchored on the end of the *pump*, not on the last arrival. A stream that died has no
    /// arrivals to anchor on, and anchoring on its last one would report the rate it managed
    /// before dying — which is precisely how a dead stream came to be reported as recovered.
    pub fn steady_state_mbps(&self, window: Duration) -> f64 {
        let window_s = window.as_secs_f64();
        let from = self.wall_seconds - window_s;
        if from < 0.0 {
            return 0.0;
        }
        let Some(&(_, total)) = self.progress.last() else {
            return 0.0;
        };
        let at_from = self
            .progress
            .iter()
            .rev()
            .find(|(at, _)| *at <= from)
            .map(|&(_, bytes)| bytes)
            .unwrap_or(0);
        ((total.saturating_sub(at_from)) as f64) / 1_000_000.0 / window_s
    }

    /// Seconds until throughput first sustains `target_mbps` over a `window`.
    ///
    /// This is the statistic a recovery target is actually about: how long the transfer stayed
    /// degraded, not how much arrived in total. `None` means it never got there.
    ///
    /// A window that has not yet elapsed cannot have been sustained, so no answer is returned
    /// before `window` and none at all for a pump shorter than one. Without that, an opening burst
    /// satisfies the window on its own and a transfer that died immediately afterwards reports a
    /// recovery that never happened.
    pub fn time_to_sustain(&self, target_mbps: f64, window: Duration) -> Option<f64> {
        let window_s = window.as_secs_f64();
        if self.wall_seconds < window_s {
            return None;
        }
        let need = target_mbps * 1_000_000.0 * window_s;

        // For each sample, look back one window; the first point where enough arrived within it is
        // when the transfer was last still degraded.
        let mut earliest = 0usize;
        for (i, &(at, bytes)) in self.progress.iter().enumerate() {
            if at < window_s {
                continue;
            }
            while self.progress[earliest].0 < at - window_s {
                earliest += 1;
            }
            if earliest == i {
                continue;
            }
            if (bytes - self.progress[earliest].1) as f64 >= need {
                return Some(at);
            }
        }
        None
    }
}

const IO_CHUNK: usize = 64 * 1024;

/// Per-chunk delay to cap the send rate at `HOPRD_PUMP_MBPS` MB/s. Blasting a large
/// payload saturates the node's rayon packet pool on CPU-constrained CI runners
/// (decode timeouts → heavy loss). Unset or ≤0 = unpaced.
fn send_pace_per_chunk() -> Option<Duration> {
    let mbps: f64 = std::env::var("HOPRD_PUMP_MBPS").ok()?.parse().ok()?;
    if mbps <= 0.0 {
        return None;
    }
    Some(Duration::from_secs_f64(
        IO_CHUNK as f64 / (mbps * 1_000_000.0),
    ))
}
/// If no bytes arrive for this long after the first byte, the return transfer is
/// considered finished (UDP loopback gives no EOF; lost tail bytes never arrive).
pub const READ_IDLE_TIMEOUT: Duration = Duration::from_secs(10);

/// How long to wait for the *first* byte back before concluding nothing is coming.
///
/// The idle rule needs an arrival to anchor on, so before anything has come back it cannot fire and
/// the reader would otherwise wait out the whole deadline. Generous against a recovery target
/// measured in tens of seconds, but far short of the deadline: a return stream that has produced
/// nothing by now has already failed, and the remaining minutes only cost wall-clock.
pub const NO_FIRST_BYTE_TIMEOUT: Duration = Duration::from_secs(30);

/// How often the reader re-evaluates whether to keep waiting.
const READ_POLL_INTERVAL: Duration = Duration::from_secs(1);

/// Whether the reader should stop, and why; `None` to keep waiting.
///
/// Pure so the stopping rule can be exercised without a session or a cluster — the rule is what
/// went wrong (a run spent seven minutes measuring a session whose server side had already ended),
/// not the plumbing around it.
fn stop_reason(
    received: usize,
    since_last_arrival: Duration,
    since_start: Duration,
    deadline: Duration,
) -> Option<PumpOutcome> {
    if since_start >= deadline {
        return Some(PumpOutcome::DeadlineExceeded);
    }
    if received == 0 {
        // Nothing has arrived at all, so the idle rule has nothing to measure from and the
        // first-byte budget decides instead.
        return (since_start >= NO_FIRST_BYTE_TIMEOUT).then_some(PumpOutcome::NeverStarted);
    }
    (since_last_arrival >= READ_IDLE_TIMEOUT).then_some(PumpOutcome::Idle)
}

pub fn sha256_digest(data: &[u8]) -> Vec<u8> {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().to_vec()
}

/// Pump `payload` through `session` to the exit-node loopback and measure return
/// goodput + loss.
///
/// Consumes the session. Use [`pump_halves`] when the same session has to survive more than one
/// pump.
pub async fn pump_loopback(
    session: HoprSession,
    payload: &[u8],
    label: &str,
    timeout: Duration,
) -> anyhow::Result<Transfer> {
    let (mut rx, mut tx) = tokio::io::split(session);
    pump_halves(&mut rx, &mut tx, payload, label, timeout, None).await
}

/// Per-chunk delay that offers `payload_bytes` at `mbps` MB/s.
///
/// Used to make a phase's offered load *last*. A payload handed to the session as fast as it will
/// take it is fully committed within seconds, so anything measured afterwards is a buffer draining
/// rather than a session working — and a recovery that takes longer than that has nothing left to
/// demonstrate itself on.
pub fn pace_for_rate(mbps: f64) -> Option<Duration> {
    (mbps > 0.0).then(|| Duration::from_secs_f64(IO_CHUNK as f64 / (mbps * 1_000_000.0)))
}

/// Reads and discards whatever is still arriving until the stream is quiet for `quiet_for`.
///
/// Between two measured phases on one session this is what stops the first phase's tail being
/// counted as the second phase's arrival. The returned byte count is itself a finding: a large
/// number means the previous phase had not actually finished when it was declared complete.
pub async fn drain_until_quiet(
    rx: &mut tokio::io::ReadHalf<HoprSession>,
    quiet_for: Duration,
    label: &str,
) -> usize {
    let mut buf = vec![0u8; IO_CHUNK];
    let mut discarded = 0usize;
    while let Ok(Ok(read)) = tokio::time::timeout(quiet_for, rx.read(&mut buf)).await {
        if read == 0 {
            break;
        }
        discarded += read;
    }
    tracing::info!("{label}: drained {discarded} B of leftover return traffic before the next phase");
    discarded
}

/// Pump `payload` to the exit-node loopback over *borrowed* session halves and measure return
/// goodput + loss.
///
/// The writer pushes the payload as the session sink accepts it (bounded-buffer
/// backpressure + the session's SURB egress cap pace it). The reader accumulates
/// returned bytes until it has the full payload back or the return stream goes idle
/// (UDP loss means the tail may never arrive). Goodput = received_bytes /
/// (first→last byte). `sha_ok` is only asserted on a lossless round-trip.
///
/// Does NOT `shutdown()` the write half: HOPR sessions have no TCP half-close.
///
/// Borrowing rather than consuming is what lets a scenario measure the *same* session before and
/// after a fault. Opening a replacement session instead measures cold-start path selection, which
/// is a different question and — for a return relayer that has just died — a much easier one: the
/// new session never minted a SURB through the dead node.
///
/// The writer runs concurrently with the reader instead of on a spawned task, because a spawned
/// task owns its half and an aborted one drops it, so `unsplit` could not reliably recover the
/// session afterwards.
pub async fn pump_halves(
    rx: &mut tokio::io::ReadHalf<HoprSession>,
    tx: &mut tokio::io::WriteHalf<HoprSession>,
    payload: &[u8],
    label: &str,
    timeout: Duration,
    pace: Option<Duration>,
) -> anyhow::Result<Transfer> {
    let expected = sha256_digest(payload);
    let total_bytes = payload.len();
    let pace = pace.or_else(send_pace_per_chunk);

    let send = async {
        let mut offset = 0;
        while offset < payload.len() {
            let end = (offset + IO_CHUNK).min(payload.len());
            tx.write_all(&payload[offset..end]).await?;
            if let Some(d) = pace {
                tokio::time::sleep(d).await;
            }
            offset = end;
        }
        tx.flush().await?;
        Ok::<_, std::io::Error>(())
    };

    let mut received: Vec<u8> = Vec::with_capacity(total_bytes);
    let mut buf = vec![0u8; IO_CHUNK];
    let mut progress: Vec<(f64, usize)> = Vec::new();
    let mut first_at: Option<std::time::Instant> = None;
    // Everything is stamped against the moment the pump started, not the first byte back. On a
    // recovering stream the interval between the two *is* the outage, and timing from the first
    // arrival discards exactly the quantity a recovery deadline is about.
    let pump_started = std::time::Instant::now();
    let mut last_at = pump_started;


    let mut outcome = PumpOutcome::Complete;
    let recv = async {
        loop {
            if received.len() >= total_bytes {
                outcome = PumpOutcome::Complete;
                break;
            }
            let now = std::time::Instant::now();
            if let Some(stop) = stop_reason(
                received.len(),
                now.saturating_duration_since(last_at),
                now.saturating_duration_since(pump_started),
                timeout,
            ) {
                tracing::warn!(
                    "{label}: stopping ({stop:?}) at {}/{total_bytes} B",
                    received.len()
                );
                outcome = stop;
                break;
            }
            // Poll rather than block for the whole idle budget, so `stop_reason` -- which owns
            // every stopping decision -- is re-evaluated on a fixed cadence.
            match tokio::time::timeout(READ_POLL_INTERVAL, rx.read(&mut buf)).await {
                Ok(Ok(0)) => {
                    tracing::warn!(
                        "{label}: counterparty closed the session at {}/{total_bytes} B",
                        received.len()
                    );
                    outcome = PumpOutcome::SessionClosed;
                    break;
                }
                Ok(Ok(just_read)) => {
                    last_at = std::time::Instant::now();
                    first_at.get_or_insert(last_at);
                    received.extend_from_slice(&buf[..just_read]);
                    progress.push((
                        last_at.saturating_duration_since(pump_started).as_secs_f64(),
                        received.len(),
                    ));
                }
                Ok(Err(e)) => return Err(anyhow::anyhow!("{label}: read error: {e}")),
                Err(_) => continue,
            }
        }
        Ok(())
    };

    // The reader owns the stopping condition; the writer is bounded only so a wedged sink cannot
    // outlive the scenario. Both borrow, so neither can be aborted out from under the session.
    let (sent, read_outcome) = tokio::join!(tokio::time::timeout(timeout, send), recv);
    read_outcome?;
    match sent {
        Ok(Ok(())) => {}
        Ok(Err(e)) => tracing::warn!("{label}: sender error: {e}"),
        Err(_) => tracing::warn!("{label}: sender did not finish within {timeout:?}"),
    }

    let first_at = first_at.unwrap_or(last_at);
    let seconds = last_at
        .saturating_duration_since(first_at)
        .as_secs_f64()
        .max(1e-9);
    let wall_seconds = pump_started.elapsed().as_secs_f64().max(1e-9);
    let received_bytes = received.len();
    let mbps = (received_bytes as f64) / 1_000_000.0 / seconds;
    let sha_ok = received_bytes == total_bytes && sha256_digest(&received) == expected;

    let transfer = Transfer {
        outcome,
        sent_bytes: total_bytes,
        received_bytes,
        seconds,
        mbps,
        sha_ok,
        wall_seconds,
        progress,
    };

    tracing::info!(
        "{label}: recv {received_bytes}/{total_bytes} B in {seconds:.2}s = {mbps:.2} MB/s \
         (wall {wall_seconds:.2}s), arrival {:.2}%, outcome {outcome:?}, ttfb {}, \
         longest stall {:.2}s, inter-arrival p50 {} / p95 {}, sha_ok={sha_ok}",
        transfer.arrival_pct(),
        transfer
            .time_to_first_byte()
            .map_or("never".to_string(), |s| format!("{s:.2}s")),
        transfer.longest_stall(),
        transfer
            .inter_arrival_quantile(0.5)
            .map_or("n/a".to_string(), |s| format!("{s:.3}s")),
        transfer
            .inter_arrival_quantile(0.95)
            .map_or("n/a".to_string(), |s| format!("{s:.3}s")),
    );

    Ok(transfer)
}

/// Pump `payload` with a **single `write_all`** — no batching, no inter-batch
/// sleep, no cooperative yield. The write task submits every packet to the session
/// sink without ever returning `Poll::Pending`, monopolising one tokio worker thread.
/// This is the production anti-pattern (`transfer_session` / `copy_duplex` over a fast
/// source) the executor-starvation profiling harness makes visible: with the SURB
/// balancer starved, the return path stalls and goodput collapses. See
/// `tests/profiling.rs`.
///
/// A read timeout is logged rather than returned as an error, so the profiling run
/// still completes and writes its trace even when the payload stalls mid-flight.
pub async fn pump_continuous(
    session: HoprSession,
    payload: &[u8],
    label: &str,
    timeout: Duration,
) -> anyhow::Result<()> {
    let (mut r, mut w) = tokio::io::split(session);
    let payload_bytes = payload.to_vec();
    let expected = sha256_digest(payload);
    let n = payload.len();
    let start = std::time::Instant::now();

    let writer = tokio::spawn(async move {
        w.write_all(&payload_bytes).await?;
        w.flush().await?;
        Ok::<_, std::io::Error>(())
    });

    let mut received = vec![0u8; n];
    let read_result = tokio::time::timeout(timeout, r.read_exact(&mut received)).await;

    let elapsed = start.elapsed();
    let kibs = throughput_kibs(n, elapsed);

    match read_result {
        Ok(Ok(_)) => {
            // Confirm the writer finished cleanly and the bytes are intact *before* logging
            // success, so a writer error or SHA mismatch never rides under a ✓ line.
            writer
                .await
                .map_err(|e| anyhow::anyhow!("{label}: writer panicked: {e}"))?
                .map_err(|e| anyhow::anyhow!("{label}: write error: {e}"))?;
            anyhow::ensure!(
                sha256_digest(&received) == expected,
                "{label}: SHA-256 mismatch — {n} bytes corrupted in transit"
            );
            tracing::info!("{label}: ✓ {n} B in {elapsed:.2?} ({kibs:.0} KiB/s) — continuous");
        }
        Ok(Err(e)) => {
            writer.abort();
            let _ = writer.await;
            anyhow::bail!("{label}: read error: {e}");
        }
        Err(_timeout) => {
            writer.abort();
            let _ = writer.await;
            // Not a hard error — the stall is the observation. `read_exact` reports no
            // partial count on timeout, so no fabricated throughput figure is logged.
            tracing::warn!(
                "{label}: read timeout ({timeout:?}) after {elapsed:.2?} — the {n} B payload did \
                 not fully arrive. Expected under executor starvation: the single write_all held a \
                 tokio worker thread without yielding, starving the SURB balancer."
            );
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A transfer with the given `(second, cumulative bytes)` arrivals over a `wall_seconds` pump.
    fn transfer(wall_seconds: f64, progress: &[(f64, usize)]) -> Transfer {
        let received_bytes = progress.last().map(|&(_, b)| b).unwrap_or(0);
        Transfer {
            outcome: PumpOutcome::Complete,
            sent_bytes: received_bytes.max(1),
            received_bytes,
            seconds: progress
                .last()
                .zip(progress.first())
                .map(|((last, _), (first, _))| last - first)
                .unwrap_or(0.0),
            mbps: 0.0,
            sha_ok: false,
            wall_seconds,
            progress: progress.to_vec(),
        }
    }

    /// One megabyte per arrival, one arrival per second, from `from` to `to` inclusive.
    fn steady(from: u64, to: u64) -> Vec<(f64, usize)> {
        (from..=to)
            .map(|s| (s as f64, ((s - from + 1) as usize) * 1_000_000))
            .collect()
    }

    /// The measurement that reported "recovered after 381.3s" for a stream that was dead.
    ///
    /// A burst delivers well over the target, the stream then delivers nothing for the rest of the
    /// pump. Anchoring on arrivals alone, the burst satisfies the window and the transfer looks
    /// recovered; the window has to be anchored in wall-clock for the burst to be seen for what it
    /// is.
    #[test]
    fn a_burst_followed_by_silence_should_not_read_as_recovery() {
        let burst = transfer(380.0, &steady(0, 2));

        assert_eq!(
            burst.time_to_sustain(0.5, Duration::from_secs(3)),
            None,
            "an opening burst is not a sustained rate"
        );
        assert_eq!(
            burst.steady_state_mbps(Duration::from_secs(3)),
            0.0,
            "the final window of a dead stream carries nothing"
        );
        assert!(
            burst.longest_stall() > 370.0,
            "the tail after the last byte is the stall, got {:.1}s",
            burst.longest_stall()
        );
    }

    /// Vacuity guard for the above: the same shape sustained to the end must read as recovered.
    #[test]
    fn a_rate_held_to_the_end_should_read_as_recovery() {
        let healthy = transfer(10.0, &steady(0, 10));

        assert!(
            healthy
                .time_to_sustain(0.5, Duration::from_secs(3))
                .is_some_and(|s| s <= 4.0),
            "a rate held throughout should recover promptly, got {:?}",
            healthy.time_to_sustain(0.5, Duration::from_secs(3))
        );
        assert!(
            healthy.steady_state_mbps(Duration::from_secs(3)) >= 0.9,
            "the final window should carry ~1 MB/s, got {:.2}",
            healthy.steady_state_mbps(Duration::from_secs(3))
        );
    }

    /// Recovery is measured from the moment the pump starts, because that is when the fault the
    /// stream is recovering from was introduced. Timing from the first byte back silently discards
    /// the entire outage.
    #[test]
    fn recovery_should_be_timed_from_the_pump_start_not_the_first_byte() {
        let late = transfer(30.0, &steady(12, 30));

        let recovered = late
            .time_to_sustain(0.5, Duration::from_secs(3))
            .expect("the stream does sustain the rate once it starts");
        assert!(
            recovered >= 12.0,
            "the 12s outage before the first byte must be counted, got {recovered:.1}s"
        );
        assert_eq!(late.time_to_first_byte(), Some(12.0));
    }

    /// A pump shorter than the sustain window cannot answer the question at all.
    #[test]
    fn a_pump_shorter_than_the_window_should_report_no_recovery() {
        let brief = transfer(1.6, &[(0.0, 4_000_000), (1.6, 8_000_000)]);

        assert_eq!(
            brief.time_to_sustain(0.5, Duration::from_secs(3)),
            None,
            "a 1.6s pump cannot demonstrate a 3s sustained rate"
        );
    }

    /// The wait for the first byte is a stall like any other, and on a recovering stream it is
    /// usually the longest one.
    #[test]
    fn the_wait_for_the_first_byte_should_count_as_a_stall() {
        let late = transfer(20.0, &steady(9, 20));

        assert!(
            (late.longest_stall() - 9.0).abs() < 1e-9,
            "the 9s opening gap is the longest stall, got {:.1}s",
            late.longest_stall()
        );
    }

    /// A stuttering stream and a uniformly slow one can carry identical totals; the p50/p95 pair is
    /// what tells them apart.
    #[test]
    fn inter_arrival_quantiles_should_separate_stutter_from_slowness() {
        let stuttering = transfer(
            20.0,
            &[
                (0.0, 1_000_000),
                (0.1, 2_000_000),
                (0.2, 3_000_000),
                (0.3, 4_000_000),
                (12.0, 5_000_000),
            ],
        );
        let p50 = stuttering.inter_arrival_quantile(0.5).expect("has gaps");
        let p95 = stuttering.inter_arrival_quantile(0.95).expect("has gaps");

        assert!(p50 <= 0.2, "typical gap should stay small, got {p50:.2}s");
        assert!(p95 > 10.0, "the outlier gap must show at p95, got {p95:.2}s");

        let smooth = transfer(5.0, &steady(0, 5));
        assert_eq!(
            smooth.inter_arrival_quantile(0.5),
            smooth.inter_arrival_quantile(0.95),
            "an evenly-paced stream has no spread between p50 and p95"
        );
    }

    // ── stopping rule ─────────────────────────────────────────────────────────

    const DEADLINE: Duration = Duration::from_secs(600);

    /// A return stream that has produced nothing has already failed; waiting out the remaining
    /// nine and a half minutes cannot change that. One run spent seven minutes measuring a session
    /// whose server side had already ended.
    #[test]
    fn a_stream_that_never_delivers_should_give_up_at_the_first_byte_budget() {
        assert_eq!(
            stop_reason(0, NO_FIRST_BYTE_TIMEOUT, NO_FIRST_BYTE_TIMEOUT, DEADLINE),
            Some(PumpOutcome::NeverStarted),
        );
        assert_eq!(
            stop_reason(
                0,
                NO_FIRST_BYTE_TIMEOUT - Duration::from_secs(1),
                NO_FIRST_BYTE_TIMEOUT - Duration::from_secs(1),
                DEADLINE
            ),
            None,
            "the budget must not expire early — a recovering stream may still be on its way"
        );
    }

    /// The idle rule needs an arrival to measure from, so before one exists it must not fire.
    /// Otherwise a stream that takes 11s to produce its first byte is cut off as idle.
    #[test]
    fn waiting_for_the_first_byte_should_not_be_cut_short_by_the_idle_rule() {
        assert_eq!(
            stop_reason(
                0,
                READ_IDLE_TIMEOUT * 2,
                READ_IDLE_TIMEOUT * 2,
                DEADLINE
            ),
            None,
            "with nothing received the first-byte budget decides, not the idle timeout"
        );
    }

    /// Once bytes have arrived, silence means the tail is never coming (UDP loopback has no EOF).
    #[test]
    fn a_stream_that_goes_quiet_after_delivering_should_stop_as_idle() {
        assert_eq!(
            stop_reason(1_000, READ_IDLE_TIMEOUT, Duration::from_secs(60), DEADLINE),
            Some(PumpOutcome::Idle),
        );
        assert_eq!(
            stop_reason(1_000, Duration::from_secs(1), Duration::from_secs(60), DEADLINE),
            None,
            "a stream still delivering must be left alone"
        );
    }

    /// A stream that is still delivering when the deadline lands is a distinct outcome from one
    /// that stopped: it was making progress and simply ran out of time.
    #[test]
    fn a_stream_still_delivering_at_the_deadline_should_report_the_deadline() {
        assert_eq!(
            stop_reason(1_000, Duration::ZERO, DEADLINE, DEADLINE),
            Some(PumpOutcome::DeadlineExceeded),
        );
    }

    /// The two "nothing is serving this session" outcomes have to be separable from the two that
    /// mean "served, but badly" — that distinction is what a scenario branches on.
    #[test]
    fn only_the_no_service_outcomes_should_report_the_exit_stopped_serving() {
        assert!(PumpOutcome::NeverStarted.exit_stopped_serving());
        assert!(PumpOutcome::SessionClosed.exit_stopped_serving());
        assert!(!PumpOutcome::Idle.exit_stopped_serving());
        assert!(!PumpOutcome::DeadlineExceeded.exit_stopped_serving());
        assert!(!PumpOutcome::Complete.exit_stopped_serving());
    }

    /// Nothing arrived at all: every statistic has to say so rather than divide by zero.
    #[test]
    fn a_stream_that_delivered_nothing_should_report_no_recovery_and_no_rate() {
        let dead = transfer(30.0, &[]);

        assert_eq!(dead.time_to_first_byte(), None);
        assert_eq!(dead.time_to_sustain(0.5, Duration::from_secs(3)), None);
        assert_eq!(dead.steady_state_mbps(Duration::from_secs(3)), 0.0);
        assert_eq!(dead.inter_arrival_quantile(0.5), None);
        assert!((dead.longest_stall() - 30.0).abs() < 1e-9);
    }
}

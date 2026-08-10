//! Reusable data-pump building block for scenarios.

use std::time::Duration;

use edgli::hopr_lib::exports::transport::HoprSession;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Result of one loopback round-trip.
#[derive(Debug, Clone)]
pub struct Transfer {
    pub sent_bytes: usize,
    pub received_bytes: usize,
    /// Wall-clock from first byte written to last byte read back.
    pub seconds: f64,
    /// Goodput = received_bytes / seconds, in MB/s.
    pub mbps: f64,
    /// True only when the full payload returned intact (received == sent and bytes match).
    pub sha_ok: bool,
}

impl Transfer {
    /// Percent of sent bytes that returned.
    pub fn arrival_pct(&self) -> f64 {
        (self.received_bytes as f64) / (self.sent_bytes.max(1) as f64) * 100.0
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
const READ_IDLE_TIMEOUT: Duration = Duration::from_secs(10);

pub fn sha256_digest(data: &[u8]) -> Vec<u8> {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().to_vec()
}

/// Pump `payload` through `session` to the exit-node loopback and measure return
/// goodput + loss.
///
/// The writer pushes the payload as the session sink accepts it (bounded-buffer
/// backpressure + the session's SURB egress cap pace it). The reader accumulates
/// returned bytes until it has the full payload back or the return stream goes idle
/// (UDP loss means the tail may never arrive). Goodput = received_bytes /
/// (first→last byte). `sha_ok` is only asserted on a lossless round-trip.
///
/// Does NOT `shutdown()` the write half: HOPR sessions have no TCP half-close.
pub async fn pump_loopback(
    session: HoprSession,
    payload: &[u8],
    label: &str,
    timeout: Duration,
) -> anyhow::Result<Transfer> {
    let (mut rx, mut tx) = tokio::io::split(session);
    let to_send = payload.to_vec();
    let expected = sha256_digest(payload);
    let total_bytes = payload.len();

    let pace = send_pace_per_chunk();
    let sender = tokio::spawn(async move {
        let mut offset = 0;
        while offset < to_send.len() {
            let end = (offset + IO_CHUNK).min(to_send.len());
            tx.write_all(&to_send[offset..end]).await?;
            if let Some(d) = pace {
                tokio::time::sleep(d).await;
            }
            offset = end;
        }
        tx.flush().await?;
        Ok::<_, std::io::Error>(())
    });

    let mut received: Vec<u8> = Vec::with_capacity(total_bytes);
    let mut buf = vec![0u8; IO_CHUNK];
    let mut first_at: Option<std::time::Instant> = None;
    let mut last_at = std::time::Instant::now();
    let overall_deadline = std::time::Instant::now() + timeout;

    while received.len() < total_bytes {
        if std::time::Instant::now() >= overall_deadline {
            tracing::warn!(
                "{label}: overall timeout, received {}/{total_bytes} B",
                received.len()
            );
            break;
        }
        match tokio::time::timeout(READ_IDLE_TIMEOUT, rx.read(&mut buf)).await {
            Ok(Ok(0)) => break, // EOF
            Ok(Ok(just_read)) => {
                first_at.get_or_insert_with(std::time::Instant::now);
                last_at = std::time::Instant::now();
                received.extend_from_slice(&buf[..just_read]);
            }
            Ok(Err(e)) => {
                sender.abort();
                return Err(anyhow::anyhow!("{label}: read error: {e}"));
            }
            Err(_) => {
                if !received.is_empty() {
                    tracing::info!(
                        "{label}: return idle {READ_IDLE_TIMEOUT:?}, stopping at {}/{total_bytes} B",
                        received.len()
                    );
                    break;
                }
            }
        }
    }

    let sender_abort = sender.abort_handle();
    match tokio::time::timeout(Duration::from_secs(10), sender).await {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => tracing::warn!("{label}: sender error: {e}"),
        Ok(Err(e)) => tracing::warn!("{label}: sender panicked: {e}"),
        Err(_) => {
            // Dropping the timed-out JoinHandle only detaches the task; abort it so
            // the writer can't keep running into the next scenario.
            sender_abort.abort();
            tracing::warn!("{label}: sender did not finish within 10s; aborted");
        }
    }

    let first_at = first_at.unwrap_or(last_at);
    let seconds = last_at
        .saturating_duration_since(first_at)
        .as_secs_f64()
        .max(1e-9);
    let received_bytes = received.len();
    let mbps = (received_bytes as f64) / 1_000_000.0 / seconds;
    let sha_ok = received_bytes == total_bytes && sha256_digest(&received) == expected;

    tracing::info!(
        "{label}: recv {received_bytes}/{total_bytes} B in {seconds:.2}s = {mbps:.2} MB/s, \
         arrival {:.2}%, sha_ok={sha_ok}",
        (received_bytes as f64) / (total_bytes.max(1) as f64) * 100.0,
    );

    Ok(Transfer {
        sent_bytes: total_bytes,
        received_bytes,
        seconds,
        mbps,
        sha_ok,
    })
}

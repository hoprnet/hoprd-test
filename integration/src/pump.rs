//! Reusable data-pump building block for scenarios.

use std::time::Duration;

use edgli::hopr_lib::exports::transport::HoprSession;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::metrics::ScenarioMetric;

const IO_CHUNK: usize = 64 * 1024;
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
/// The writer pushes the whole payload as fast as the session sink accepts it
/// (bounded-buffer backpressure paces it — no artificial sleep), so the rate
/// reflects the stack under the exit's SURB egress rate control. The reader
/// accumulates returned bytes until it has the full payload back or the return
/// stream goes idle (UDP loss means the tail may never arrive). Goodput =
/// received_bytes / (first→last byte). `sha_ok` is only asserted on a lossless
/// round-trip.
///
/// Does NOT `shutdown()` the write half: HOPR sessions have no TCP half-close.
pub async fn pump_loopback(
    session: HoprSession,
    payload: &[u8],
    label: &str,
    timeout: Duration,
) -> anyhow::Result<ScenarioMetric> {
    let (mut r, mut w) = tokio::io::split(session);
    let payload_bytes = payload.to_vec();
    let expected = sha256_digest(payload);
    let n = payload.len();

    let writer = tokio::spawn(async move {
        let mut offset = 0;
        while offset < payload_bytes.len() {
            let end = (offset + IO_CHUNK).min(payload_bytes.len());
            w.write_all(&payload_bytes[offset..end]).await?;
            offset = end;
        }
        w.flush().await?;
        Ok::<_, std::io::Error>(())
    });

    let mut received: Vec<u8> = Vec::with_capacity(n);
    let mut buf = vec![0u8; IO_CHUNK];
    let mut first_at: Option<std::time::Instant> = None;
    let mut last_at = std::time::Instant::now();
    let overall_deadline = std::time::Instant::now() + timeout;

    while received.len() < n {
        if std::time::Instant::now() >= overall_deadline {
            tracing::warn!(
                "{label}: overall timeout, received {}/{n} B",
                received.len()
            );
            break;
        }
        match tokio::time::timeout(READ_IDLE_TIMEOUT, r.read(&mut buf)).await {
            Ok(Ok(0)) => break, // EOF
            Ok(Ok(m)) => {
                first_at.get_or_insert_with(std::time::Instant::now);
                last_at = std::time::Instant::now();
                received.extend_from_slice(&buf[..m]);
            }
            Ok(Err(e)) => {
                writer.abort();
                return Err(anyhow::anyhow!("{label}: read error: {e}"));
            }
            Err(_) => {
                if !received.is_empty() {
                    tracing::info!(
                        "{label}: return idle {READ_IDLE_TIMEOUT:?}, stopping at {}/{n} B",
                        received.len()
                    );
                    break;
                }
            }
        }
    }

    match tokio::time::timeout(Duration::from_secs(10), writer).await {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => tracing::warn!("{label}: writer error: {e}"),
        Ok(Err(e)) => tracing::warn!("{label}: writer panicked: {e}"),
        Err(_) => tracing::warn!("{label}: writer did not finish within 10s"),
    }

    let first_at = first_at.unwrap_or(last_at);
    let seconds = last_at
        .saturating_duration_since(first_at)
        .as_secs_f64()
        .max(1e-9);
    let received_bytes = received.len();
    let mbps = (received_bytes as f64) / 1_000_000.0 / seconds;
    let loss_pct = ((n.saturating_sub(received_bytes)) as f64) / (n.max(1) as f64) * 100.0;
    let sha_ok = received_bytes == n && sha256_digest(&received) == expected;

    tracing::info!(
        "{label}: recv {received_bytes}/{n} B in {seconds:.2}s = {mbps:.2} MB/s, \
         loss {loss_pct:.2}%, sha_ok={sha_ok}"
    );

    Ok(ScenarioMetric {
        scenario: label.to_string(),
        sent_bytes: n,
        received_bytes,
        seconds,
        mbps,
        loss_pct,
        sha_ok,
    })
}

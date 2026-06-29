//! Per-scenario metrics + JSON output.

use anyhow::Context as _;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ScenarioMetric {
    pub scenario: String,
    pub sent_bytes: usize,
    pub received_bytes: usize,
    /// Wall-clock from first byte written to last byte read back.
    pub seconds: f64,
    /// Goodput = received_bytes / seconds, in MB/s.
    pub mbps: f64,
    /// (sent - received) / sent * 100. UDP loopback is lossy under rate control.
    pub loss_pct: f64,
    /// True only when the full payload returned intact (received == sent and bytes match).
    pub sha_ok: bool,
}

pub fn write_metrics(path: &std::path::Path, metrics: &[ScenarioMetric]) -> anyhow::Result<()> {
    let json = serde_json::to_string_pretty(metrics)?;
    std::fs::write(path, json).with_context(|| format!("writing metrics to {}", path.display()))?;
    tracing::info!("metrics written to {}", path.display());
    Ok(())
}

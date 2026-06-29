//! Scenario abstraction. A scenario runs one test against the shared
//! [`IntegrationEnv`](crate::env::IntegrationEnv) and returns a metric.
//!
//! To add a scenario: implement [`Scenario`] in `src/scenarios/`, then register it
//! in [`registry`]. The driver runs each selected scenario against the same env
//! (no teardown between) and gates each independently.

use async_trait::async_trait;

use crate::{config::RunConfig, env::IntegrationEnv, metrics::ScenarioMetric};

#[async_trait]
pub trait Scenario: Send + Sync {
    /// Stable identifier — appears in metrics, logs, gate messages, and the
    /// `HOPRD_E2E_SCENARIOS` selector / `HOPRD_E2E_FLOOR_<NAME>_MBPS` knob.
    fn name(&self) -> &'static str;

    /// Run the scenario against the shared environment.
    async fn run(&self, env: &IntegrationEnv, cfg: &RunConfig) -> anyhow::Result<ScenarioMetric>;
}

/// Every registered scenario. **Add new scenarios here.**
pub fn registry() -> Vec<Box<dyn Scenario>> {
    vec![
        Box::new(crate::scenarios::ZeroHopThroughput),
        Box::new(crate::scenarios::OneHopThroughput),
    ]
}

/// Gate one scenario's metric. Returns failure messages (empty = pass).
///
/// Loss and corruption are distinct: UDP may drop the tail (handled by the loss
/// ceiling), but bytes that *do* return must never be wrong.
pub fn gate(cfg: &RunConfig, m: &ScenarioMetric) -> Vec<String> {
    let mut failures = Vec::new();
    if m.received_bytes == 0 {
        failures.push(format!(
            "{}: no data returned from exit loopback",
            m.scenario
        ));
    }
    if m.received_bytes == m.sent_bytes && !m.sha_ok {
        failures.push(format!(
            "{}: returned data corrupted (SHA-256 mismatch)",
            m.scenario
        ));
    }
    if m.loss_pct > cfg.max_loss_pct {
        failures.push(format!(
            "{}: loss {:.2}% exceeds ceiling {:.2}%",
            m.scenario, m.loss_pct, cfg.max_loss_pct
        ));
    }
    let floor = cfg.floor_mbps(&m.scenario);
    if floor > 0.0 && m.mbps < floor {
        failures.push(format!(
            "{}: goodput {:.2} MB/s below floor {:.2} MB/s",
            m.scenario, m.mbps, floor
        ));
    }
    failures
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn cfg(floor_0: f64, floor_1: f64, max_loss: f64) -> RunConfig {
        let mut floors = HashMap::new();
        floors.insert("0-hop".to_string(), floor_0);
        floors.insert("1-hop".to_string(), floor_1);
        RunConfig {
            payload_bytes: crate::config::MIN_PAYLOAD_BYTES,
            floors_mbps: floors,
            max_loss_pct: max_loss,
            max_secs: 600,
            only: vec![],
            metrics_path: std::path::PathBuf::from("metrics.json"),
        }
    }

    fn metric(name: &str, sent: usize, received: usize, mbps: f64, sha_ok: bool) -> ScenarioMetric {
        ScenarioMetric {
            scenario: name.into(),
            sent_bytes: sent,
            received_bytes: received,
            seconds: 1.0,
            mbps,
            loss_pct: ((sent.saturating_sub(received)) as f64) / (sent.max(1) as f64) * 100.0,
            sha_ok,
        }
    }

    #[test]
    fn flags_low_goodput_and_corruption() {
        let c = cfg(5.0, 1.0, 10.0);
        let low = gate(&c, &metric("0-hop", 100, 100, 2.0, true));
        assert!(low.iter().any(|s| s.contains("0-hop: goodput")), "{low:?}");
        let corrupt = gate(&c, &metric("1-hop", 100, 100, 9.0, false));
        assert!(
            corrupt
                .iter()
                .any(|s| s.contains("returned data corrupted")),
            "{corrupt:?}"
        );
    }

    #[test]
    fn flags_excess_loss_but_not_partial_as_corruption() {
        let c = cfg(0.0, 0.0, 10.0);
        let lossy = gate(&c, &metric("0-hop", 100, 50, 9.0, false));
        assert!(lossy.iter().any(|s| s.contains("0-hop: loss")), "{lossy:?}");
        assert!(!lossy.iter().any(|s| s.contains("corrupted")), "{lossy:?}");
    }

    #[test]
    fn passes_within_bounds() {
        let c = cfg(1.0, 1.0, 10.0);
        assert!(gate(&c, &metric("0-hop", 100, 100, 2.0, true)).is_empty());
        // 5% loss, under ceiling, partial return → not corruption
        assert!(gate(&c, &metric("1-hop", 100, 95, 2.0, false)).is_empty());
    }
}

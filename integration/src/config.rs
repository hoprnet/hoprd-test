//! Run configuration, read from the environment.

use std::{path::PathBuf, time::Duration};

pub const DEFAULT_PAYLOAD_BYTES: usize = 10 * 1024 * 1024; // 10 MiB
pub const MIN_PAYLOAD_BYTES: usize = 10 * 1024 * 1024; // 10 MiB
pub const MAX_PAYLOAD_BYTES: usize = 50 * 1024 * 1024; // 50 MiB

/// Per-run knobs shared by every scenario.
pub struct RunConfig {
    pub payload_bytes: usize,
    /// Per-scenario goodput floor in MB/s, keyed by scenario name. 0 / absent = off.
    pub floors_mbps: std::collections::HashMap<String, f64>,
    /// Max acceptable per-scenario datagram loss (percent). UDP is unreliable, so
    /// some loss is expected; default 100 = disabled until calibrated.
    pub max_loss_pct: f64,
    /// Overall per-scenario timeout.
    pub max_secs: u64,
    /// Scenario names to run (empty = all registered).
    pub only: Vec<String>,
    pub metrics_path: PathBuf,
}

impl RunConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let payload_bytes = parse("HOPRD_E2E_PAYLOAD_BYTES", DEFAULT_PAYLOAD_BYTES)?;
        anyhow::ensure!(
            (MIN_PAYLOAD_BYTES..=MAX_PAYLOAD_BYTES).contains(&payload_bytes),
            "HOPRD_E2E_PAYLOAD_BYTES must be within [{MIN_PAYLOAD_BYTES}, {MAX_PAYLOAD_BYTES}] \
             (10–50 MiB); got {payload_bytes}"
        );

        // Per-scenario floors are read lazily by name (see `floor_mbps`); seed the
        // two built-in ones here for convenience.
        let mut floors_mbps = std::collections::HashMap::new();
        floors_mbps.insert(
            "0-hop".to_string(),
            parse("HOPRD_E2E_FLOOR_0HOP_MBPS", 0.0)?,
        );
        floors_mbps.insert(
            "1-hop".to_string(),
            parse("HOPRD_E2E_FLOOR_1HOP_MBPS", 0.0)?,
        );

        let only = std::env::var("HOPRD_E2E_SCENARIOS")
            .ok()
            .map(|s| {
                s.split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_default();

        Ok(Self {
            payload_bytes,
            floors_mbps,
            max_loss_pct: parse("HOPRD_E2E_MAX_LOSS_PCT", 100.0)?,
            max_secs: parse("HOPRD_E2E_MAX_SECS", 600)?,
            only,
            metrics_path: parse("HOPRD_E2E_METRICS_PATH", PathBuf::from("metrics.json"))?,
        })
    }

    /// Goodput floor for a scenario. Convention `HOPRD_E2E_FLOOR_<NAME>_MBPS`
    /// (name upper-cased, non-alphanumerics → `_`) overrides the seeded value.
    pub fn floor_mbps(&self, scenario: &str) -> f64 {
        let var = format!(
            "HOPRD_E2E_FLOOR_{}_MBPS",
            scenario
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() {
                    c.to_ascii_uppercase()
                } else {
                    '_'
                })
                .collect::<String>()
        );
        if let Ok(v) = std::env::var(&var)
            && let Ok(f) = v.parse::<f64>()
        {
            return f;
        }
        self.floors_mbps.get(scenario).copied().unwrap_or(0.0)
    }

    pub fn pump_timeout(&self) -> Duration {
        Duration::from_secs(self.max_secs)
    }

    pub fn selected(&self, name: &str) -> bool {
        self.only.is_empty() || self.only.iter().any(|n| n == name)
    }
}

fn parse<T: std::str::FromStr>(var: &str, default: T) -> anyhow::Result<T>
where
    T::Err: std::fmt::Display,
{
    match std::env::var(var) {
        Ok(v) => v
            .parse::<T>()
            .map_err(|e| anyhow::anyhow!("{var}: invalid value '{v}': {e}")),
        Err(_) => Ok(default),
    }
}

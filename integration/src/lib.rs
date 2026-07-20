//! Integration-test framework for the HOPR stack.
//!
//! Brings up a 3-node `hoprd-localcluster` (anvil + blokli + 3 `hoprd` processes,
//! full-mesh channels — contracts deployed by the chain container, see
//! [`cluster`]) and an `edgli` edge client into a shared
//! [`IntegrationEnv`](env::IntegrationEnv), then pumps a payload through a UDP
//! session to the exit node's built-in loopback and measures goodput + loss.
//!
//! Each hop count is its own `#[test]` (see `tests/integration.rs`) so 0-hop and
//! 1-hop are reported independently; every test owns its cluster (bring up →
//! run → tear down). The `zero_hop`/`one_hop` correctness gates are hardcoded;
//! the `high_volume_downlink` repro is tunable via env (see below).
//!
//! ## Modes
//! - **Managed** (default): set `HOPRD_LOCALCLUSTER_BIN`, `HOPRD_BIN`,
//!   `HOPRD_CHAIN_IMAGE` (a `bloklid-anvil` image), optional
//!   `HOPRD_CONTAINER_RUNTIME` (default `docker`).
//! - **External**: set `HOPRD_CLUSTER_DATA_DIR` (+ `HOPRD_LOCALCLUSTER_BIN`).
//!
//! ## Repro tuning knobs (`high_volume_downlink` only; all optional)
//! - `HOPRD_PAYLOAD_BYTES` — payload size (default 200 MiB).
//! - `HOPRD_PUMP_MBPS` — send-rate cap in MB/s (default 0.46; `<=0` = unpaced).
//! - `HOPRD_TARGET_SURB` — SURB balancer exit-buffer target (default 3000).
//! - `HOPRD_READ_IDLE_SECS` — return-idle stall cutoff (default 30).
//! - `HOPRD_CLUSTER_LATENCY` — per-node relay latency, e.g. `150ms±50ms` (off by default).
//! - `EDGLI_PROBE_LOCAL_ADDRESSES` — no longer read; local probing is always on.

pub mod cluster;
pub mod env;
pub mod pump;

/// Payload size for the correctness scenarios (`zero_hop`, `one_hop`). Small and
/// fast so they stay a quick pass/fail gate. Also sizes the strategy's expected
/// packet count for channel funding (see [`env`]).
pub const PAYLOAD_BYTES: usize = 10 * 1024 * 1024; // 10 MiB

/// Default payload for the high-volume repro. 200 MiB reliably drives the
/// downlink SURB return-path past its cumulative tipping point (see
/// `stress-findings/`); the collapse is volume-driven, not rate-driven.
pub const HIGH_VOLUME_PAYLOAD_BYTES: usize = 200 * 1024 * 1024; // 200 MiB

/// High-volume payload size: `HOPRD_PAYLOAD_BYTES` if set, else
/// [`HIGH_VOLUME_PAYLOAD_BYTES`]. Lets the repro scale without a rebuild.
pub fn payload_bytes() -> usize {
    std::env::var("HOPRD_PAYLOAD_BYTES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(HIGH_VOLUME_PAYLOAD_BYTES)
}

/// Exit-buffer target for the SURB balancer: `HOPRD_TARGET_SURB` if set, else 3000.
pub fn target_surb_buffer_size() -> u64 {
    std::env::var("HOPRD_TARGET_SURB")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000)
}

pub use env::IntegrationEnv;

/// On-chain address type, re-exported so submodules share one definition.
pub use edgli::hopr_lib::api::types::primitive::prelude::Address;

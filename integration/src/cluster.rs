//! Local cluster lifecycle — bring up (or attach to) a `hoprd-localcluster`.
//!
//! `hoprd-localcluster` is the orchestrator: it starts the chain container, funds
//! the node Safes via `hopli`, spawns the `hoprd` processes, and opens the
//! full-mesh channels.
//!
//! **Contracts.** We do NOT deploy contracts here. The `bloklid-anvil` chain
//! image deploys the full HOPR contract set on startup (its entrypoint runs
//! anvil → `blokli-contract-deployer` → writes the addresses into the bloklid
//! config), so by the time blokli answers `/readyz` the contracts are live and
//! their addresses are served to the nodes. The only case lacking contracts is
//! pointing `HOPRD_CHAIN_URL` at a foreign chain — not used by managed mode.

use std::{path::PathBuf, time::Duration};

use anyhow::Context as _;

use crate::Address;

pub const CLUSTER_SIZE: usize = 3;
pub const API_PORT_BASE: u16 = 13000;
pub const P2P_PORT_BASE: u16 = 19000;
pub const API_HOST: &str = "127.0.0.1";
pub const API_TOKEN: &str = "test-token-localcluster";

const CLUSTER_START_TIMEOUT: Duration = Duration::from_secs(600);
const READYZ_TIMEOUT: Duration = Duration::from_secs(120);
const PEER_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(120);
const INTRACLUSTER_CHANNEL_TIMEOUT: Duration = Duration::from_secs(120);

// ── Cluster summary ─────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ExtraInfo {
    pub safe_address: Address,
    pub module_address: Address,
    pub keystore_path: PathBuf,
    pub password: String,
}

#[derive(Debug, Clone)]
pub struct ClusterSummary {
    pub blokli_url: String,
    pub node_addresses: Vec<Address>,
    pub extras: Vec<ExtraInfo>,
}

// ── `hoprd-localcluster status` wire types ────────────────────────────────────

#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
enum ClusterStateWire {
    NotRunning,
    Initializing,
    Starting,
    Running,
    ShuttingDown,
    Failed,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, serde::Deserialize)]
struct ClusterSummaryWire {
    state: ClusterStateWire,
    #[serde(default)]
    blokli_url: Option<String>,
    #[serde(default)]
    nodes: Vec<NodeSummaryWire>,
    #[serde(default)]
    extras: Vec<ExtraSummaryWire>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct NodeSummaryWire {
    address: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct ExtraSummaryWire {
    safe_address: String,
    module_address: String,
    keystore_path: String,
    password: String,
}

fn wire_into_summary(wire: ClusterSummaryWire) -> anyhow::Result<ClusterSummary> {
    let blokli_url = wire
        .blokli_url
        .ok_or_else(|| anyhow::anyhow!("blokli_url missing from running cluster status"))?;

    let node_addresses = wire
        .nodes
        .into_iter()
        .map(|n| {
            n.address
                .ok_or_else(|| anyhow::anyhow!("node address is null in running cluster status"))?
                .parse::<Address>()
                .context("invalid node address")
        })
        .collect::<anyhow::Result<Vec<_>>>()?;
    anyhow::ensure!(!node_addresses.is_empty(), "no nodes in cluster status");

    let extras = wire
        .extras
        .into_iter()
        .map(|e| {
            Ok(ExtraInfo {
                safe_address: e
                    .safe_address
                    .parse::<Address>()
                    .context("invalid safe_address")?,
                module_address: e
                    .module_address
                    .parse::<Address>()
                    .context("invalid module_address")?,
                keystore_path: PathBuf::from(e.keystore_path),
                password: e.password,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()?;
    anyhow::ensure!(!extras.is_empty(), "no extra identities in cluster status");

    Ok(ClusterSummary {
        blokli_url,
        node_addresses,
        extras,
    })
}

#[cfg(test)]
pub(crate) fn parse_summary_json(json: &str) -> anyhow::Result<ClusterSummary> {
    let wire: ClusterSummaryWire =
        serde_json::from_str(json).context("failed to parse cluster status JSON")?;
    wire_into_summary(wire)
}

// ── RAII handle ───────────────────────────────────────────────────────────────

pub struct ClusterHandle {
    /// `Some` when we started the cluster; `None` in external mode.
    child: Option<tokio::process::Child>,
    pub summary: ClusterSummary,
    _tempdir: Option<tempfile::TempDir>,
}

impl Drop for ClusterHandle {
    fn drop(&mut self) {
        let Some(child) = self.child.as_mut() else {
            return; // external cluster — leave it alone
        };
        #[cfg(unix)]
        if let Some(pid) = child.id() {
            use nix::sys::signal::{Signal, kill};
            use nix::unistd::Pid;
            let _ = kill(Pid::from_raw(pid as i32), Signal::SIGINT);
        }
        let deadline = std::time::Instant::now() + Duration::from_secs(30);
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) if std::time::Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(500));
                }
                _ => {
                    let _ = child.start_kill();
                    break;
                }
            }
        }
    }
}

/// Bring up the cluster (managed mode) or attach to a running one (external mode),
/// then wait until it is fully ready (nodes up, peers visible, full-mesh channels).
pub async fn bring_up() -> anyhow::Result<ClusterHandle> {
    let handle = provision().await?;
    tracing::info!("verifying cluster: /readyz");
    await_nodes_ready().await?;
    tracing::info!("verifying cluster: full P2P peer visibility");
    await_cluster_peers_discovered().await?;
    tracing::info!("verifying cluster: full-mesh outgoing channels Open");
    await_intracluster_channels_open().await?;
    Ok(handle)
}

async fn provision() -> anyhow::Result<ClusterHandle> {
    if let Ok(data_dir) = std::env::var("HOPRD_CLUSTER_DATA_DIR") {
        return attach_external(&data_dir).await;
    }
    spawn_managed().await
}

async fn attach_external(data_dir: &str) -> anyhow::Result<ClusterHandle> {
    let lc_bin = std::env::var("HOPRD_LOCALCLUSTER_BIN").map_err(|_| {
        anyhow::anyhow!("HOPRD_LOCALCLUSTER_BIN required even in external mode (to run `status`)")
    })?;
    let out = tokio::process::Command::new(&lc_bin)
        .args(["status", "--data-dir", data_dir])
        .output()
        .await
        .with_context(|| format!("running `{lc_bin} status --data-dir {data_dir}`"))?;
    let json = String::from_utf8_lossy(&out.stdout);
    let wire: ClusterSummaryWire =
        serde_json::from_str(&json).context("failed to parse cluster status JSON")?;
    anyhow::ensure!(
        matches!(wire.state, ClusterStateWire::Running),
        "cluster at {data_dir} is '{:?}', not 'running'",
        wire.state
    );
    let summary = wire_into_summary(wire)?;
    tracing::info!(blokli_url = %summary.blokli_url, "attached to external cluster");
    Ok(ClusterHandle {
        child: None,
        summary,
        _tempdir: None,
    })
}

/// A test that aborts (e.g. SIGABRT on a stack overflow) skips [`ClusterHandle`]'s
/// Drop, leaking its chain container + node processes onto the fixed ports and
/// breaking the next serial test. Managed mode owns those ports, so clear any
/// leftover before bringing up.
fn reap_stale(chain_image: &str, runtime: &str, lc_bin: &str, hoprd_bin: &str) {
    let script = format!(
        "{runtime} ps -aq --filter ancestor={chain_image} | xargs -r {runtime} rm -f; \
         pkill -9 -f {lc_bin}; pkill -9 -f {hoprd_bin}; true"
    );
    match std::process::Command::new("sh")
        .arg("-c")
        .arg(&script)
        .status()
    {
        Ok(_) => tracing::info!("reaped stale cluster state (container + node processes)"),
        Err(e) => tracing::warn!("reap of stale cluster state failed: {e}"),
    }
}

async fn spawn_managed() -> anyhow::Result<ClusterHandle> {
    let lc_bin = std::env::var("HOPRD_LOCALCLUSTER_BIN")
        .map_err(|_| anyhow::anyhow!("HOPRD_LOCALCLUSTER_BIN is not set"))?;
    let hoprd_bin =
        std::env::var("HOPRD_BIN").map_err(|_| anyhow::anyhow!("HOPRD_BIN is not set"))?;
    let chain_url = std::env::var("HOPRD_CHAIN_URL").ok();
    let chain_image = std::env::var("HOPRD_CHAIN_IMAGE").ok();
    let container_runtime = std::env::var("HOPRD_CONTAINER_RUNTIME").ok();

    // External chain (HOPRD_CHAIN_URL, e.g. a locally-built bloklid) skips the
    // container; only image mode has a stale container to reap.
    if chain_url.is_none() {
        let image = chain_image.as_deref().ok_or_else(|| {
            anyhow::anyhow!("set HOPRD_CHAIN_URL (external chain) or HOPRD_CHAIN_IMAGE (container)")
        })?;
        reap_stale(
            image,
            container_runtime.as_deref().unwrap_or("docker"),
            &lc_bin,
            &hoprd_bin,
        );
    }

    let tempdir = tempfile::TempDir::with_prefix("hoprd-it-")?;
    let data_dir = tempdir.path().to_path_buf();

    let mut cmd = tokio::process::Command::new(&lc_bin);
    cmd.args([
        "--hoprd-bin",
        &hoprd_bin,
        "--size",
        &CLUSTER_SIZE.to_string(),
        "--extra-identities",
        "1",
        "--data-dir",
        data_dir.to_str().unwrap(),
        "--api-host",
        API_HOST,
        "--api-port-base",
        &API_PORT_BASE.to_string(),
        "--p2p-port-base",
        &P2P_PORT_BASE.to_string(),
        "--api-token",
        API_TOKEN,
    ]);
    if let Some(url) = &chain_url {
        cmd.args(["--chain-url", url]);
    } else {
        cmd.args(["--chain-image", chain_image.as_deref().unwrap()]);
    }
    if let Some(runtime) = container_runtime {
        cmd.args(["--container-runtime", &runtime]);
    }
    cmd.env("HOPRD_USE_OPENTELEMETRY", "false");
    cmd.stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit());

    let mut child = cmd.spawn()?;
    let stdout = child.stdout.take().expect("stdout captured");
    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt as _;
        let mut lines = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            tracing::info!(target: "localcluster", "{}", line);
        }
    });

    let summary = match wait_status_running(
        std::path::Path::new(&lc_bin),
        &data_dir,
        CLUSTER_START_TIMEOUT,
        &mut child,
    )
    .await
    {
        Ok(s) => s,
        Err(err) => {
            #[cfg(unix)]
            if let Some(pid) = child.id() {
                let _ = nix::sys::signal::kill(
                    nix::unistd::Pid::from_raw(pid as i32),
                    nix::sys::signal::Signal::SIGINT,
                );
            }
            let _ = child.start_kill();
            return Err(err);
        }
    };

    tracing::info!(blokli_url = %summary.blokli_url, "cluster up");
    Ok(ClusterHandle {
        child: Some(child),
        summary,
        _tempdir: Some(tempdir),
    })
}

async fn wait_status_running(
    lc_bin: &std::path::Path,
    data_dir: &std::path::Path,
    timeout: Duration,
    child: &mut tokio::process::Child,
) -> anyhow::Result<ClusterSummary> {
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        if let Ok(Some(status)) = child.try_wait() {
            anyhow::bail!("hoprd-localcluster exited prematurely with status {status:?}");
        }
        let out = tokio::process::Command::new(lc_bin)
            .args(["status", "--data-dir", data_dir.to_str().unwrap()])
            .output()
            .await
            .context("failed to run `hoprd-localcluster status`")?;
        match serde_json::from_str::<ClusterSummaryWire>(&String::from_utf8_lossy(&out.stdout)) {
            Ok(wire) => match wire.state {
                ClusterStateWire::Running => return wire_into_summary(wire),
                ClusterStateWire::Failed => {
                    anyhow::bail!(
                        "localcluster failed: {}",
                        wire.error.as_deref().unwrap_or("unknown error")
                    )
                }
                state => tracing::debug!("cluster status: {state:?}"),
            },
            Err(_) => tracing::debug!("cluster status: not yet parseable"),
        }
        anyhow::ensure!(
            tokio::time::Instant::now() < deadline,
            "timeout ({timeout:?}) waiting for cluster 'running'"
        );
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}

// ── Readiness polling (plain reqwest against the node REST APIs) ───────────────

fn node_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap()
}

fn auth_header() -> String {
    format!("Bearer {API_TOKEN}")
}

async fn poll_cluster_until<Fut>(
    timeout: Duration,
    sleep: Duration,
    timeout_msg: &str,
    mut check_node: impl FnMut(usize, u16) -> Fut,
) -> anyhow::Result<()>
where
    Fut: std::future::Future<Output = bool>,
{
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        let results = futures::future::join_all(
            (0..CLUSTER_SIZE).map(|i| check_node(i, API_PORT_BASE + i as u16)),
        )
        .await;
        if results.into_iter().all(|ok| ok) {
            return Ok(());
        }
        anyhow::ensure!(tokio::time::Instant::now() < deadline, "{timeout_msg}");
        tokio::time::sleep(sleep).await;
    }
}

async fn await_nodes_ready() -> anyhow::Result<()> {
    let client = node_http_client();
    poll_cluster_until(
        READYZ_TIMEOUT,
        Duration::from_secs(3),
        "timeout waiting for cluster /readyz",
        |_i, port| {
            let client = client.clone();
            async move {
                client
                    .get(format!("http://{API_HOST}:{port}/readyz"))
                    .send()
                    .await
                    .map(|r| r.status().is_success())
                    .unwrap_or(false)
            }
        },
    )
    .await
}

async fn await_cluster_peers_discovered() -> anyhow::Result<()> {
    let client = node_http_client();
    let expected = CLUSTER_SIZE - 1;
    poll_cluster_until(
        PEER_DISCOVERY_TIMEOUT,
        Duration::from_secs(3),
        "timeout waiting for cluster peer discovery",
        |_i, port| {
            let client = client.clone();
            async move {
                let n = async {
                    let body: serde_json::Value = client
                        .get(format!("http://{API_HOST}:{port}/api/v4/network/announced"))
                        .header("Authorization", auth_header())
                        .send()
                        .await?
                        .json()
                        .await?;
                    anyhow::Ok(body.as_array().map(|a| a.len()).unwrap_or(0))
                }
                .await
                .unwrap_or(0);
                n >= expected
            }
        },
    )
    .await
}

async fn await_intracluster_channels_open() -> anyhow::Result<()> {
    let client = node_http_client();
    let expected = CLUSTER_SIZE - 1;
    poll_cluster_until(
        INTRACLUSTER_CHANNEL_TIMEOUT,
        Duration::from_secs(5),
        "timeout waiting for intracluster channels to open",
        |_i, port| {
            let client = client.clone();
            async move {
                let open = async {
                    let body: serde_json::Value = client
                        .get(format!(
                            "http://{API_HOST}:{port}/api/v4/channels?includingClosed=false"
                        ))
                        .header("Authorization", auth_header())
                        .send()
                        .await?
                        .json()
                        .await?;
                    anyhow::Ok(
                        body["outgoing"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter(|ch| ch["status"].as_str() == Some("Open"))
                                    .count()
                            })
                            .unwrap_or(0),
                    )
                }
                .await
                .unwrap_or(0);
                open >= expected
            }
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    const RUNNING_SNAPSHOT: &str = r#"{
  "state": "running",
  "blokli_url": "http://127.0.0.1:8545",
  "nodes": [
    { "id": 0, "address": "0x1111111111111111111111111111111111111111" },
    { "id": 1, "address": "0x2222222222222222222222222222222222222222" },
    { "id": 2, "address": "0x3333333333333333333333333333333333333333" }
  ],
  "extras": [
    { "id": 0, "safe_address": "0x5555555555555555555555555555555555555555", "module_address": "0x6666666666666666666666666666666666666666", "keystore_path": "/tmp/c/extra_id_0.id", "password": "local-cluster" }
  ]
}"#;

    #[test]
    fn parses_running_snapshot() {
        let s = parse_summary_json(RUNNING_SNAPSHOT).unwrap();
        assert_eq!(s.blokli_url, "http://127.0.0.1:8545");
        assert_eq!(s.node_addresses.len(), 3);
        assert_eq!(s.extras.len(), 1);
        assert_eq!(s.extras[0].password, "local-cluster");
    }

    #[test]
    fn rejects_null_node_address() {
        let json = r#"{ "state": "running", "blokli_url": "http://x", "nodes": [ { "id": 0, "address": null } ], "extras": [] }"#;
        assert!(parse_summary_json(json).is_err());
    }
}

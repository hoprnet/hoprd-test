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

/// Node count used unless `HOPRD_CLUSTER_SIZE` overrides it.
pub const DEFAULT_CLUSTER_SIZE: usize = 3;
/// `hoprd-localcluster` only carries this many baked-in node secrets.
pub const MAX_CLUSTER_SIZE: usize = 5;

static REQUESTED_SIZE: std::sync::OnceLock<usize> = std::sync::OnceLock::new();

/// Ask for a cluster of `n` nodes, before the first [`bring_up`].
///
/// Return-path scenarios need more relayer candidates than the throughput tests, so the
/// size is a knob rather than a constant. First call in a test binary wins — the size is
/// read from several places during bring-up and readiness polling, and must not change
/// underneath them. Returns the size actually in effect.
pub fn request_cluster_size(n: usize) -> usize {
    let clamped = n.clamp(1, MAX_CLUSTER_SIZE);
    let effective = *REQUESTED_SIZE.get_or_init(|| clamped);
    if effective != clamped {
        tracing::warn!(
            requested = clamped,
            effective,
            "cluster size already fixed by an earlier call; keeping it"
        );
    }
    effective
}

/// Number of `hoprd` nodes to run: [`request_cluster_size`] if called, else
/// `HOPRD_CLUSTER_SIZE`, else [`DEFAULT_CLUSTER_SIZE`] — clamped to `1..=MAX_CLUSTER_SIZE`.
pub fn cluster_size() -> usize {
    REQUESTED_SIZE.get().copied().unwrap_or_else(|| {
        std::env::var("HOPRD_CLUSTER_SIZE")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(DEFAULT_CLUSTER_SIZE)
            .clamp(1, MAX_CLUSTER_SIZE)
    })
}

static REQUESTED_LATENCY: std::sync::OnceLock<String> = std::sync::OnceLock::new();

/// Ask for artificial inter-node latency, before the first [`bring_up`].
///
/// `yaml` is a `hoprd-localcluster` latency config (`default` / `per_node` / `per_link`;
/// see `docs/localcluster/README.md`) and is written to the cluster's data dir and passed
/// as `--latency config:<path>`.
///
/// Why a test would want this: on an unshaped local cluster every relayer probes at
/// essentially the same latency, so all path weights are equal and *any* selection
/// strategy — weighted-random included — comes out uniform over enough draws. Giving the
/// nodes distinct inbound delays is what creates the score spread that makes a weighted
/// draw concentrate, which is the condition the return-path scenarios need to be able to
/// tell selection strategies apart. First call in a test binary wins.
pub fn request_latency_profile(yaml: impl Into<String>) -> &'static str {
    REQUESTED_LATENCY.get_or_init(|| yaml.into())
}

pub const API_PORT_BASE: u16 = 13000;
pub const P2P_PORT_BASE: u16 = 19000;
pub const API_HOST: &str = "127.0.0.1";
pub const API_TOKEN: &str = "test-token-localcluster";

const CLUSTER_START_TIMEOUT: Duration = Duration::from_secs(600);
const READYZ_TIMEOUT: Duration = Duration::from_secs(120);
const PEER_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(120);
const INTRACLUSTER_CHANNEL_TIMEOUT: Duration = Duration::from_secs(120);

// ── Cluster summary ─────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct ExtraInfo {
    pub safe_address: Address,
    pub module_address: Address,
    pub keystore_path: PathBuf,
    pub password: String,
}

// Manual Debug so a `?extra` / `{:?}` on an ExtraInfo (directly or via ClusterSummary) can
// never leak the keystore password into logs — the local-cluster password is a known
// constant, but the Rotsee one is a real secret.
impl std::fmt::Debug for ExtraInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ExtraInfo")
            .field("safe_address", &self.safe_address)
            .field("module_address", &self.module_address)
            .field("keystore_path", &self.keystore_path)
            .field("password", &"<redacted>")
            .finish()
    }
}

/// A running cluster node: who it is, how to query it, and how to kill it.
#[derive(Debug, Clone)]
pub struct NodeInfo {
    pub address: Address,
    /// REST API base URL (no trailing slash).
    pub api_url: String,
    /// Bearer token, or `None` when the node runs without authentication.
    pub api_token: Option<String>,
    /// OS pid of the `hoprd` process, for scenarios that take a node down mid-run.
    pub pid: Option<u32>,
}

impl NodeInfo {
    /// SIGKILL this node's `hoprd` process, simulating a relay that drops off the
    /// network without closing anything down — the failure mode behind the
    /// 2026-08-11 return-path break.
    ///
    /// SIGKILL rather than SIGTERM on purpose: a clean shutdown would let the node
    /// announce its departure, which is not what a crashed or partitioned relay does.
    #[cfg(unix)]
    pub fn kill(&self) -> anyhow::Result<()> {
        let pid = self
            .pid
            .ok_or_else(|| anyhow::anyhow!("node {} has no pid in cluster status", self.address))?;
        nix::sys::signal::kill(
            nix::unistd::Pid::from_raw(pid as i32),
            nix::sys::signal::Signal::SIGKILL,
        )
        .with_context(|| format!("SIGKILL node {} (pid {pid})", self.address))?;
        tracing::info!(node = %self.address, pid, "killed relay node");
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct ClusterSummary {
    pub blokli_url: String,
    pub nodes: Vec<NodeInfo>,
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
    api_url: String,
    #[serde(default)]
    api_token: Option<String>,
    #[serde(default)]
    pid: Option<u32>,
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

    let nodes = wire
        .nodes
        .into_iter()
        .map(|n| {
            Ok(NodeInfo {
                address: n
                    .address
                    .ok_or_else(|| {
                        anyhow::anyhow!("node address is null in running cluster status")
                    })?
                    .parse::<Address>()
                    .context("invalid node address")?,
                api_url: n.api_url.trim_end_matches('/').to_string(),
                api_token: n.api_token,
                pid: n.pid,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()?;
    anyhow::ensure!(!nodes.is_empty(), "no nodes in cluster status");

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
        nodes,
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
                    // Deadline hit or try_wait errored: SIGKILL, then reap — start_kill
                    // only signals, so without a wait the process lingers as a zombie.
                    let _ = child.start_kill();
                    let reap_deadline = std::time::Instant::now() + Duration::from_secs(5);
                    while std::time::Instant::now() < reap_deadline {
                        if matches!(child.try_wait(), Ok(Some(_))) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
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
        &cluster_size().to_string(),
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
    // Written inside the data dir so it lives exactly as long as the cluster does.
    if let Some(yaml) = REQUESTED_LATENCY.get() {
        let path = data_dir.join("latency.yaml");
        std::fs::write(&path, yaml).context("writing latency profile")?;
        cmd.args(["--latency", &format!("config:{}", path.to_str().unwrap())]);
        tracing::info!(?path, "cluster will run with an artificial latency profile");
    }
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

    // Node logs live inside the temp dir, which is removed when the handle drops -- so by the time
    // a failure is worth investigating, the only per-node evidence is already gone. Leaking the
    // handle keeps the whole cluster directory for post-mortem.
    let tempdir = if std::env::var_os("HOPRD_KEEP_ARTIFACTS").is_some() {
        tracing::info!(path = %tempdir.path().display(), "keeping cluster artifacts");
        std::mem::forget(tempdir);
        None
    } else {
        Some(tempdir)
    };

    Ok(ClusterHandle {
        child: Some(child),
        summary,
        _tempdir: tempdir,
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
            (0..cluster_size()).map(|i| check_node(i, API_PORT_BASE + i as u16)),
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
    let expected = cluster_size() - 1;
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
    let expected = cluster_size() - 1;
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
    { "id": 0, "address": "0x1111111111111111111111111111111111111111", "api_url": "http://127.0.0.1:13000/", "api_token": "tok", "pid": 101 },
    { "id": 1, "address": "0x2222222222222222222222222222222222222222", "api_url": "http://127.0.0.1:13001", "api_token": "tok", "pid": 102 },
    { "id": 2, "address": "0x3333333333333333333333333333333333333333", "api_url": "http://127.0.0.1:13002", "api_token": null, "pid": null }
  ],
  "extras": [
    { "id": 0, "safe_address": "0x5555555555555555555555555555555555555555", "module_address": "0x6666666666666666666666666666666666666666", "keystore_path": "/tmp/c/extra_id_0.id", "password": "local-cluster" }
  ]
}"#;

    #[test]
    fn parses_running_snapshot() -> anyhow::Result<()> {
        let s = parse_summary_json(RUNNING_SNAPSHOT)?;
        assert_eq!(s.blokli_url, "http://127.0.0.1:8545");
        assert_eq!(s.nodes.len(), 3);
        assert_eq!(s.extras.len(), 1);
        assert_eq!(s.extras[0].password, "local-cluster");
        Ok(())
    }

    /// The metrics scrape and the kill-a-relayer scenario both hang off these three
    /// fields, so a status schema that stops carrying them must fail loudly here.
    #[test]
    fn parses_node_api_endpoint_and_pid() -> anyhow::Result<()> {
        let s = parse_summary_json(RUNNING_SNAPSHOT)?;
        // Trailing slash stripped so `{api_url}/metrics` never doubles it.
        assert_eq!(s.nodes[0].api_url, "http://127.0.0.1:13000");
        assert_eq!(s.nodes[0].api_token.as_deref(), Some("tok"));
        assert_eq!(s.nodes[0].pid, Some(101));
        assert_eq!(s.nodes[2].api_token, None);
        assert_eq!(s.nodes[2].pid, None);
        Ok(())
    }

    #[test]
    fn rejects_null_node_address() {
        let json = r#"{ "state": "running", "blokli_url": "http://x", "nodes": [ { "id": 0, "address": null, "api_url": "http://x" } ], "extras": [] }"#;
        assert!(parse_summary_json(json).is_err());
    }
}

//! The integration environment: a running cluster + a booted `edgli` edge client
//! with open channels. Each test builds one via [`IntegrationEnv::setup`] and gets
//! sessions via [`IntegrationEnv::open_unreliable_session`]; it tears down on drop.

use std::time::Duration;

use edgli::{
    BlockchainConnectorConfig, BlokliEndpoint, Edgli, EdgliInitState,
    hopr_lib::{
        HopRouting, HoprKeys, HoprSessionClientConfig, IdentityRetrievalModes,
        api::{
            node::HoprSessionClientOperations,
            types::internal::channels::{ChannelEntry, ChannelStatus},
        },
        config::{HoprLibConfig, HostConfig, HostType, SafeModule},
        exports::transport::{
            HoprSession, SESSION_MTU, SURB_SIZE, SessionCapability, SessionTarget,
            SurbBalancerConfig,
        },
    },
    strategy::{EdgeStrategyKind, EligibilityConfig, IncentiveConfiguration, default_strategy_cfg},
    traits::EdgeNodeApi,
};

use crate::{
    Address,
    cluster::{self, CLUSTER_SIZE, ClusterHandle, P2P_PORT_BASE},
};

/// Edgli's P2P port — one slot beyond the cluster nodes.
const EDGE_P2P_PORT: u16 = P2P_PORT_BASE + CLUSTER_SIZE as u16;

const PEER_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(120);
const CHANNEL_OPEN_TIMEOUT: Duration = Duration::from_secs(120);

pub struct IntegrationEnv {
    // Field order matters for drop: edgli first (cancels tasks), then cluster.
    edgli: Edgli,
    _reactor: futures::future::AbortHandle,
    /// 0-hop destination: a peer Edgli has a direct open channel to.
    dest_zero_hop: Address,
    /// 1-hop destination: a different connected peer (the 0-hop peer relays).
    dest_one_hop: Address,
    _cluster: ClusterHandle,
}

impl Drop for IntegrationEnv {
    fn drop(&mut self) {
        // `futures::AbortHandle`'s own Drop does not abort the reactor — stop it
        // explicitly. The struct's fields then drop in declaration order (edgli
        // cancels its tasks, then the cluster tears down).
        self._reactor.abort();
    }
}

impl IntegrationEnv {
    /// Bring up the cluster, boot Edgli on the pre-funded extra identity, start the
    /// channel strategy, and wait until at least one outgoing channel is open.
    pub async fn setup() -> anyhow::Result<Self> {
        let cluster = cluster::bring_up().await?;
        let summary = cluster.summary.clone();
        let extra = summary.extras[0].clone();

        let hopr_keys: HoprKeys = IdentityRetrievalModes::FromFile {
            password: &extra.password,
            id_path: extra.keystore_path.to_str().unwrap(),
        }
        .try_into()?;

        tracing::info!(safe = %extra.safe_address, "booting Edgli");
        let edgli = Edgli::new(
            edgli_config(&extra.safe_address, &extra.module_address),
            hopr_keys,
            BlokliEndpoint::from_optional_url(Some(summary.blokli_url.as_str()))?,
            Some(connector_cfg()),
            // Localcluster peers announce loopback/private addresses; probe them or no dial happens.
            true,
            |s: EdgliInitState| tracing::info!(?s, "edgli init"),
        )
        .await?;

        tracing::info!("waiting for Edgli to connect to ≥2 peers");
        await_edgli_peers_connected(&edgli, 2).await?;

        let sizing = IncentiveConfiguration {
            min_open_channels: 1,
            target_open_channels: CLUSTER_SIZE,
            ..Default::default()
        };
        let mut strat_cfg = default_strategy_cfg(&edgli, &sizing).await?;
        for kind in &mut strat_cfg.strategies {
            let EdgeStrategyKind::ChannelLifecycle(lc) = kind;
            lc.eligibility = EligibilityConfig {
                min_peer_quality_score: 0.0,
                require_observed_since_start: false,
                ..Default::default()
            };
            lc.tick_interval = Duration::from_secs(10);
        }
        let reactor = edgli.run_reactor_from_cfg(strat_cfg)?;

        tracing::info!("waiting for strategy to open ≥1 outgoing channel");
        await_edgli_channels_open(&edgli, 1, CHANNEL_OPEN_TIMEOUT).await?;

        let (dest_zero_hop, dest_one_hop) = select_session_targets(&edgli).await?;

        Ok(Self {
            edgli,
            _reactor: reactor,
            dest_zero_hop,
            dest_one_hop,
            _cluster: cluster,
        })
    }

    /// Open an unreliable (`Segmentation`-only, no retransmission) session over
    /// `hops` relays to the exit node's built-in loopback service. Rate control
    /// is left ON.
    pub async fn open_unreliable_session(&self, hops: usize) -> anyhow::Result<HoprSession> {
        let dest = match hops {
            0 => self.dest_zero_hop,
            1 => self.dest_one_hop,
            n => anyhow::bail!("unsupported hop count {n} (cluster supports 0 and 1)"),
        };
        let (session, _) = self
            .edgli
            .connect_to(
                dest,
                SessionTarget::ExitNode(0), // built-in loopback service
                HoprSessionClientConfig {
                    forward_path: HopRouting::try_from(hops)?,
                    return_path: HopRouting::try_from(hops)?,
                    // Mirror gnosis_vpn-client's main (WG) data session — the real
                    // high-throughput config (gnosis_vpn-lib connection/options.rs +
                    // up/runner.rs). A too-low SURB mint ceiling starves the exit's
                    // return path under sustained downlink; provision it like production.
                    capabilities: SessionCapability::Segmentation | SessionCapability::NoDelay,
                    always_max_out_surbs: true,
                    surb_management: Some(SurbBalancerConfig {
                        // gnosis main: 10 MB response buffer, 16 Mb/s SURB upstream.
                        target_surb_buffer_size: 10_000_000 / SESSION_MTU as u64,
                        max_surbs_per_sec: 16_000_000 / (8 * SURB_SIZE as u64),
                        ..SurbBalancerConfig::default()
                    }),
                    ..Default::default()
                },
            )
            .await?;
        Ok(session)
    }
}

fn connector_cfg() -> BlockchainConnectorConfig {
    BlockchainConnectorConfig {
        // Default tx-confirmation budget is too tight for blokli's SSE indexing on Anvil.
        tx_timeout_multiplier: 10,
        ..Default::default()
    }
}

fn edgli_config(safe_address: &Address, module_address: &Address) -> HoprLibConfig {
    use edgli::hopr_lib::config::{HoprProtocolConfig, MixerConfig, TransportConfig};
    use edgli::hopr_lib::exports::transport::path::PathPlannerConfig;
    HoprLibConfig {
        host: HostConfig {
            address: HostType::IPv4("0.0.0.0".to_string()),
            port: EDGE_P2P_PORT,
        },
        publish: true,
        protocol: HoprProtocolConfig {
            transport: TransportConfig {
                announce_local_addresses: true,
                prefer_local_addresses: true,
            },
            path_planner: PathPlannerConfig {
                min_ack_rate: 0.1, // local cluster probes succeed
                ..Default::default()
            },
            mixer: MixerConfig {
                min_delay: Duration::ZERO,
                delay_range: Duration::from_millis(1),
                ..Default::default()
            },
            ..Default::default()
        },
        safe_module: SafeModule {
            safe_address: *safe_address,
            module_address: *module_address,
        },
        ..Default::default()
    }
}

async fn await_edgli_peers_connected(edgli: &Edgli, min_peers: usize) -> anyhow::Result<()> {
    poll_until(
        PEER_DISCOVERY_TIMEOUT,
        Duration::from_secs(3),
        "Edgli peer discovery",
        || async {
            let peers = edgli.connected_peer_addresses().await?;
            Ok(peers.len() >= min_peers)
        },
    )
    .await
}

async fn await_edgli_channels_open(
    edgli: &Edgli,
    min_open: usize,
    timeout: Duration,
) -> anyhow::Result<()> {
    poll_until(
        timeout,
        Duration::from_secs(5),
        "Edgli channel open",
        || async {
            let channels: Vec<ChannelEntry> = edgli.my_outgoing_channels().await?;
            Ok(channels
                .iter()
                .filter(|c| c.status == ChannelStatus::Open)
                .count()
                >= min_open)
        },
    )
    .await
}

async fn select_session_targets(edgli: &Edgli) -> anyhow::Result<(Address, Address)> {
    let (raw_channels, peers) = tokio::try_join!(
        edgli.my_outgoing_channels(),
        edgli.connected_peer_addresses()
    )?;
    let zero_hop = raw_channels
        .into_iter()
        .find(|c| c.status == ChannelStatus::Open)
        .ok_or_else(|| anyhow::anyhow!("no open outgoing channels"))?
        .destination;
    let one_hop = peers
        .into_iter()
        .find(|a| *a != zero_hop)
        .ok_or_else(|| anyhow::anyhow!("need ≥2 distinct connected peers for 1-hop"))?;
    tracing::info!(zero_hop = %zero_hop, one_hop = %one_hop, "session targets selected");
    Ok((zero_hop, one_hop))
}

async fn poll_until<F, Fut>(
    timeout: Duration,
    sleep: Duration,
    what: &str,
    mut check: F,
) -> anyhow::Result<()>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<bool>>,
{
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        if check().await? {
            return Ok(());
        }
        anyhow::ensure!(
            tokio::time::Instant::now() < deadline,
            "timeout ({timeout:?}) waiting for {what}"
        );
        tokio::time::sleep(sleep).await;
    }
}

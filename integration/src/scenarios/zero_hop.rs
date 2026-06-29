//! 0-hop UDP throughput: Edgli → exit node directly, no relay.

use async_trait::async_trait;
use rand::RngExt as _;

use crate::{
    config::RunConfig, env::IntegrationEnv, metrics::ScenarioMetric, pump::pump_loopback,
    scenario::Scenario,
};

pub struct ZeroHopThroughput;

#[async_trait]
impl Scenario for ZeroHopThroughput {
    fn name(&self) -> &'static str {
        "0-hop"
    }

    async fn run(&self, env: &IntegrationEnv, cfg: &RunConfig) -> anyhow::Result<ScenarioMetric> {
        let session = env.open_udp_session(0).await?;
        // Random bytes → unique packet ciphertexts per run (avoids replay-tag hits).
        let mut payload = vec![0u8; cfg.payload_bytes];
        rand::rng().fill(&mut payload[..]);
        pump_loopback(session, &payload, self.name(), cfg.pump_timeout()).await
    }
}

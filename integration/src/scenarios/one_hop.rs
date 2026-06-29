//! 1-hop UDP throughput: Edgli → relay → exit node.

use async_trait::async_trait;
use rand::RngExt as _;

use crate::{
    config::RunConfig, env::IntegrationEnv, metrics::ScenarioMetric, pump::pump_loopback,
    scenario::Scenario,
};

pub struct OneHopThroughput;

#[async_trait]
impl Scenario for OneHopThroughput {
    fn name(&self) -> &'static str {
        "1-hop"
    }

    async fn run(&self, env: &IntegrationEnv, cfg: &RunConfig) -> anyhow::Result<ScenarioMetric> {
        let session = env.open_udp_session(1).await?;
        let mut payload = vec![0u8; cfg.payload_bytes];
        rand::rng().fill(&mut payload[..]);
        pump_loopback(session, &payload, self.name(), cfg.pump_timeout()).await
    }
}

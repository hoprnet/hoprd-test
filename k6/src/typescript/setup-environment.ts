import * as fs from 'fs';
import Handlebars from "handlebars";
import { HoprdNode } from './hoprd-node';
import { checkNodes, setupChannels, sendTestMessages } from './setup-tasks';

const setupEnvironment = async (nodes: HoprdNode[]) => {
  try {
    // Check nodes
    await checkNodes(nodes, 10)
    // Setup channels
    await setupChannels(nodes) 

    // Send test messages
    await sendTestMessages(nodes)
  } catch (error) {
    console.error('Environment setup tasks failed:', error);
    throw error;
  }
}

// Main
const executionName = process.env.K6_EXECUTION_NAME || 'kubernetes';
const testScript = process.env.K6_TEST_SCRIPT || 'udp';
const clusterNodes = process.env.K6_CLUSTER_NODES || "core-rotsee";
const topologyName = process.env.K6_TOPOLOGY_NAME || 'receiver';
const workloadName = process.env.K6_WORKLOAD_NAME || 'sanity-check';
const skipHoprdSessions = process.env.K6_SKIP_HOPRD_SESSIONS || 'false';
const skipScenarioDownload = process.env.K6_SKIP_SCENARIO_DOWNLOAD || 'false';
const skipScenarioUpload = process.env.K6_SKIP_SCENARIO_UPLOAD || 'false';
const sessionCapabilities = process.env.K6_SESSION_CAPABILITIES || 'NoDelay,Segmentation';
const sessionMaxSurbUpstream = parseInt(process.env.K6_SESSION_MAX_SURB_UPSTREAM || '2000');
const sessionResponseBuffer = parseInt(process.env.K6_SESSION_RESPONSE_BUFFER || '2');
const echoServersReplicas = parseInt(process.env.K6_ECHO_SERVERS_REPLICAS || '3');
const duration = parseInt(process.env.K6_TEST_DURATION || '1');
const iterationTimeout = parseInt(process.env.K6_ITERATION_TIMEOUT || '60');
const vuPerRoute = parseInt(process.env.K6_VU_PER_ROUTE || '1');
const payloadSize = parseInt(process.env.K6_PAYLOAD_SIZE || '1048576'); // 1MB
const downloadThroughput = parseInt(process.env.K6_DOWNLOAD_THROUGHPUT || '262144'); // 256KB/s
const uploadThroughput = parseInt(process.env.K6_UPLOAD_THROUGHPUT || '262144'); // 256KB/s

const templateParams = {
  executionName,
  testScript,
  clusterNodes,
  topologyName,
  workloadName,
  skipHoprdSessions,
  skipScenarioDownload,
  skipScenarioUpload,
  sessionCapabilities,
  sessionMaxSurbUpstream,
  sessionResponseBuffer,
  echoServersReplicas,
  duration,
  iterationTimeout,
  vuPerRoute,
  payloadSize,
  downloadThroughput,
  uploadThroughput
}


let hoprdNodes: HoprdNode[] = [];
try {
  const clusterNodesData = JSON.parse(fs.readFileSync(`assets/cluster-nodes-${clusterNodes}.json`).toString()).nodes;
  const topologyNodesData = JSON.parse(fs.readFileSync(`assets/topology-${topologyName}.json`).toString()).nodes;
  const getClusterNodeByName = (nodeName: string) => clusterNodesData.filter((node: any) => node.name === nodeName)[0];
  hoprdNodes = topologyNodesData
        .filter((node: any) => {
          if (!node.enabled) {
            console.log(`[WARN] Skipping node ${node.name} as it is disabled`)
          }
          return node.enabled;
        })
        .map(async (topologyNode: any) => {
            topologyNode.apiToken = process.env.HOPRD_API_TOKEN
            let node = getClusterNodeByName(topologyNode.name);
            topologyNode.url = node.url;
            topologyNode.instance = node.instance;
            topologyNode.p2p = node.p2p;
            let hoprdNode = new HoprdNode(topologyNode);
            await hoprdNode.init();
            return hoprdNode;
        });
} catch (error) {
  console.error(`Failed to read or parse nodes data files for topology ${topologyName} and workload ${workloadName}:`, error);
  process.exit(1);
}


Promise.all(hoprdNodes).then((hoprdNodes: HoprdNode[]) => {
  setupEnvironment(hoprdNodes).then(() => {
    console.log('[INFO] Environment fully setup')

    // Generate k6 test run file
    const k6TestRunTemplateData = fs.readFileSync(`assets/k6-test-run.yaml`).toString()
    const k6TestRunTemplate = Handlebars.compile(k6TestRunTemplateData);
    const k6TestRunTemplateParsed = k6TestRunTemplate(templateParams);
    fs.writeFileSync(`./k6-test-run.yaml`, k6TestRunTemplateParsed)

    // Generate k6 test results file
    const k6TestResultsTemplateData = fs.readFileSync(`assets/k6-test-results.yaml`).toString()
    const k6TestResultsTemplate = Handlebars.compile(k6TestResultsTemplateData);
    const k6TestResultsTemplateParsed = k6TestResultsTemplate(templateParams);
    fs.writeFileSync(`./k6-test-results.yaml`, k6TestResultsTemplateParsed)

  }).catch((error) => {
    console.error('Failed to generate k6 manifest files:', error);
    console.error(error)
  });
})

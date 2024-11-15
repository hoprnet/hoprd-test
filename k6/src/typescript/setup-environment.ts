import * as fs from 'fs';
import Handlebars from "handlebars";
import { HoprdNode } from './hoprd-node';
import { checkNodes, setupChannels } from './setup-tasks';

const setupEnvironment = async (nodes: HoprdNode[]) => {
  try {
    // Check nodes
    await checkNodes(nodes, 10)
    // Setup channels
    await setupChannels(nodes)  
  } catch (error) {
    console.error('Environment setup tasks failed:', error);
    throw error; // Re-throw to be caught by the Promise chain
  }
}

// Main
const clusterNodes = process.env.K6_CLUSTER_NODES || "core";
const topologyName = process.env.K6_TOPOLOGY_NAME || 'many2many';
const workloadName = process.env.K6_WORKLOAD_NAME || 'sanity-check';
const testid = process.env.TESTID || 'kubernetes';
const requestsPerSecondPerVu = parseInt(process.env.K6_REQUESTS_PER_SECOND_PER_VU || '1', 10);
const duration = parseInt(process.env.K6_DURATION || '30',10);
const vuPerRoute = parseInt(process.env.K6_VU_PER_ROUTE || '1', 10);
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
    const k6TestRunTemplateParsed = k6TestRunTemplate({ clusterNodes, topologyName, workloadName, requestsPerSecondPerVu, testid, duration, vuPerRoute });
    fs.writeFileSync(`./k6-test-run.yaml`, k6TestRunTemplateParsed)

    // Generate k6 test results file
    const k6TestResultsTemplateData = fs.readFileSync(`assets/k6-test-results.yaml`).toString()
    const k6TestResultsTemplate = Handlebars.compile(k6TestResultsTemplateData);
    const k6TestResultsTemplateParsed = k6TestResultsTemplate({ clusterNodes, topologyName, workloadName, requestsPerSecondPerVu, testid, duration });
    fs.writeFileSync(`./k6-test-results.yaml`, k6TestResultsTemplateParsed)

  }).catch((error) => {
    console.error('Failed to generate k6 manifest files:', error);
    console.error(error)
  });
})

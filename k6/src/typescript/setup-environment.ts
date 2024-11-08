import * as fs from 'fs';
import Handlebars from "handlebars";
import { HoprdNode } from './hoprd-node';
import { checkNodes, setupChannels } from './setup-tasks';

const setupEnvironment = async (nodes: HoprdNode[]) => {

  // Check nodes
  await checkNodes(nodes, 10)

  // Setup channels
  await setupChannels(nodes)  

}

// Main
const nodes = process.env.NODES || 'many2many'
const workloadName = process.env.WORKLOAD_NAME || 'sanity-check'
const testid = process.env.TESTID || 'kubernetes'
const requestsPerSecondPerVu = process.env.REQUESTS_PER_SECOND_PER_VU || 1
const duration = process.env.DURATION || "30"
const vuPerRoute = process.env.VU_PER_ROUTE || 1
const nodesData = JSON.parse(fs.readFileSync(`assets/nodes-${nodes}.json`).toString())
const enabledNodes: HoprdNode[] = nodesData.nodes
  .filter((node: any) => node.enabled)
  .map(async (node: any) => {
  let hoprdNode = new HoprdNode(node);
  await hoprdNode.init();
  return hoprdNode;
});
nodesData.nodes.filter((node: any) => !node.enabled).forEach((node: any) => { console.log(`[INFO] Node ${node.name} is disabled`) })

Promise.all(enabledNodes).then((hoprdNodes: HoprdNode[]) => {
  setupEnvironment(hoprdNodes).then(() => {
    console.log('[INFO] Environment fully setup')

    // Generate k6 test run file
    const k6TestRunTemplateData = fs.readFileSync(`assets/k6-test-run.yaml`).toString()
    const k6TestRunTemplate = Handlebars.compile(k6TestRunTemplateData);
    const k6TestRunTemplateParsed = k6TestRunTemplate({ nodes, workloadName, requestsPerSecondPerVu, testid, duration, vuPerRoute });
    fs.writeFileSync(`./k6-test-run.yaml`, k6TestRunTemplateParsed)

    // Generate k6 test results file
    const k6TestResultsTemplateData = fs.readFileSync(`assets/k6-test-results.yaml`).toString()
    const k6TestResultsTemplate = Handlebars.compile(k6TestResultsTemplateData);
    const k6TestResultsTemplateParsed = k6TestResultsTemplate({ nodes, workloadName, requestsPerSecondPerVu, testid, duration });
    fs.writeFileSync(`./k6-test-results.yaml`, k6TestResultsTemplateParsed)

  }).catch((err) => console.error(err))
})

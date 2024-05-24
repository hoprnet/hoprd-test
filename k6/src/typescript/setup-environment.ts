import * as fs from 'fs';
import Handlebars from "handlebars";
import { HoprdNode } from './hoprd-node';

const setupEnvironment = async () => {

  const maxRetries = 10;
  let retries = 0;
  let checkNodes: Promise<{node: HoprdNode, status: boolean}>[] = nodes.map((node:HoprdNode) => node.check().then(status => ({node, status})));
  while (checkNodes.length > 0 && retries < maxRetries) {
    const results: {node: HoprdNode, status: boolean}[] = await Promise.all(checkNodes);
    
    // Filter out the nodes that were checked successfully
    checkNodes = results.filter(result => !result.status).map(result => result.node.check().then(status => ({node: result.node, status})));

    if (checkNodes.length > 0) {
      if (retries < maxRetries - 1) { // if it's not the last iteration
        console.error(`[ERROR] Retrying in 60 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        console.error(`[ERROR] Review the previous errors checking nodes. Exiting after ${maxRetries} attempts.`)
        process.exit(1);
      }
    }
    retries++;
  }

  // Open channels nodes
  const openChannels: Promise<string[]> [] = []
  nodes.forEach((node:HoprdNode) => { openChannels.push(node.openChannels(nodes))})

  const nodePendingTransactions: string[][] = await Promise.all(openChannels)
    if (nodePendingTransactions.flat().length > 0 ) {
      console.error(`[ERROR] There are ${nodePendingTransactions.flat().length} channels pending to be openned`)
      process.exit(1);
    }
}

// Main
const environmentName = process.env.ENVIRONMENT_NAME || 'rotsee'
const workloadName = process.env.WORKLOAD_NAME || 'sanity-check'
const testid = process.env.TESTID || 'kubernetes'
const iterations = process.env.SCENARIO_ITERATIONS || 1
const duration = process.env.SCENARIO_DURATION || "10m"
const hoprdNodeThreads = process.env.HOPRD_NODE_THREADS || 1
const nodesData = JSON.parse(fs.readFileSync(`assets/nodes-${environmentName}.json`).toString())
const nodes: HoprdNode[]= nodesData.nodes.map((node: any) => new HoprdNode(node));


setupEnvironment().then(() => {
  console.log('[INFO] Environment fully setup')

  // Generate k6 test run file
  const k6TestRunTemplateData = fs.readFileSync(`assets/k6-test-run.yaml`).toString()
  const k6TestRunTemplate = Handlebars.compile(k6TestRunTemplateData);
  const k6TestRunTemplateParsed = k6TestRunTemplate({ environmentName, workloadName, iterations, testid, duration, hoprdNodeThreads });
  fs.writeFileSync(`./k6-test-run.yaml`, k6TestRunTemplateParsed)

  // Generate k6 test results file
  const k6TestResultsTemplateData = fs.readFileSync(`assets/k6-test-results.yaml`).toString()
  const k6TestResultsTemplate = Handlebars.compile(k6TestResultsTemplateData);
  const k6TestResultsTemplateParsed = k6TestResultsTemplate({ environmentName, workloadName, iterations, testid, duration });
  fs.writeFileSync(`./k6-test-results.yaml`, k6TestResultsTemplateParsed)

}).catch((err) => console.error(err))

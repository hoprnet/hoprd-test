import * as fs from 'fs';
import Handlebars from "handlebars";
import { HoprdNode } from './hoprd-node';

const setupEnvironment = async () => {

  // Check nodes
  const checkNodes: Promise<boolean> [] = []
  nodes.forEach((node:HoprdNode) => { checkNodes.push(node.check())})
  await Promise.all(checkNodes).then((results: boolean[]) => {
    if (results.filter(result => ! result).length != 0) {
      console.error(`[ERROR] Review the previous errors checking nodes`)
      process.exit(1);
    }
  })

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
const iterations = process.env.SCENARIO_ITERATIONS || 1
const nodesData = JSON.parse(fs.readFileSync(`assets/nodes-${environmentName}.json`).toString())
const nodes: HoprdNode[]= nodesData.nodes.map((node: any) => new HoprdNode(node));


setupEnvironment().then(() => {
  console.log('[INFO] Environment fully setup')
  const k6TestRunTemplateData = fs.readFileSync(`assets/k6-test-run.yaml`).toString()
  const k6TestRunTemplate = Handlebars.compile(k6TestRunTemplateData);
  const k6TestRunTemplateParsed = k6TestRunTemplate({ environmentName, workloadName, iterations });
  fs.writeFileSync(`./k6-test-run.yaml`, k6TestRunTemplateParsed)

}).catch((err) => console.error(err))

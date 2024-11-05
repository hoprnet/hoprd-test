import { HoprdNode } from './hoprd-node';

type HoprdNodeStatus = {
  node: HoprdNode,
  status: boolean
}

export async function checkNodes(nodes: HoprdNode[], maxRetries: number) {
  console.log(`[INFO] Checking nodes healthiness...`)
  let retries = 0;
  let checkNodes: Promise<HoprdNodeStatus>[] = nodes.map((node:HoprdNode) => node.check().then(status => ({node, status})));
  while (checkNodes.length > 0 && retries < maxRetries) {
    const results: HoprdNodeStatus[] = await Promise.all(checkNodes);
    
    // Filter out the nodes that were checked successfully
    checkNodes = results.filter(result => !result.status).map(result => result.node.check().then(status => ({node: result.node, status})));

    if (checkNodes.length > 0) {
      if (retries <= maxRetries) { // if it's not the last iteration
        console.error(`[ERROR] Retrying in 60 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        console.error(`[ERROR] Review the previous errors checking nodes. Exiting after ${maxRetries} attempts.`)
        process.exit(1);
      }
    }
    retries++;
  }
}

export async function setupChannels(nodes: HoprdNode[]) {
  console.log(`[INFO] Setting up channels...`)
  // Open channels nodes
  const enabledNodes: HoprdNode[] = nodes.filter((node:HoprdNode) => node.data.enabled)
  const syncNodes: Promise<string[]> [] = []

  for (let node of enabledNodes) {
    syncNodes.push(node.syncChannels(enabledNodes))
  }
  await Promise.all(syncNodes);
}

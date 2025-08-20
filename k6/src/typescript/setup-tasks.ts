import { HoprdNode } from './hoprd-node';

type HoprdNodeStatus = {
  node: HoprdNode,
  status: boolean
}

export async function checkNodes(nodes: HoprdNode[], maxRetries: number) {
  console.log(`[INFO] Checking nodes healthiness...`)
  let retries = 0;
  let checkNodes: Promise<HoprdNodeStatus>[] = nodes.map((node: HoprdNode) => node.check().then(status => ({ node, status })));
  while (checkNodes.length > 0 && retries < maxRetries) {
    const results: HoprdNodeStatus[] = await Promise.all(checkNodes);

    // Filter out the nodes that were checked successfully
    checkNodes = results.filter(result => !result.status).map(result => result.node.check().then(status => ({ node: result.node, status })));

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
  const enabledNodes: HoprdNode[] = nodes.filter((node: HoprdNode) => node.data.enabled)
  const syncNodes: Promise<string[]>[] = []

  for (let node of enabledNodes) {
    syncNodes.push(node.syncChannels(enabledNodes))
  }
  await Promise.all(syncNodes);
}

export async function sendTestMessages(nodes: HoprdNode[]) {
  const entryNodes: HoprdNode[] = [];
  const relayerNodes: HoprdNode[] = [];
  const exitNodes: HoprdNode[] = [];
  nodes.forEach((node: HoprdNode) => {
      if (node.data.isEntryNode) {
        entryNodes.push(node);
      }
      if (node.data.isRelayerNode) {
        relayerNodes.push(node);
      }
      if (node.data.isExitNode) {
        exitNodes.push(node);
      }
    });

  const routes = entryNodes.flatMap(entryNode => {
      return exitNodes.flatMap(exitNode => {
        return relayerNodes.map(relayerNode => { return { entryNode, relayerNode, exitNode }; });
    })
  })
  .filter((route) =>
    route.entryNode.nativeAddress !== route.exitNode.nativeAddress &&
    route.entryNode.nativeAddress !== route.relayerNode.nativeAddress &&
    route.relayerNode.nativeAddress !== route.exitNode.nativeAddress
  );

  // Sequentially send messages
  let failedMessages = 0;
  for (const route of routes) {
    const messageSent = await route.entryNode.sendMessageOverSession(route.relayerNode, route.exitNode);
    if (!messageSent) {
      failedMessages++;
    }
  }

  if (failedMessages > 0) {
    throw new Error(`Failed to send ${failedMessages} messages`);
  }
}

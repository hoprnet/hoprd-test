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
  const senders: HoprdNode[] = [];
  const relayers: HoprdNode[] = [];
  const receivers: HoprdNode[] = [];
  nodes.forEach((node: HoprdNode) => {
      if (node.data.isSender) {
        senders.push(node);
      }
      if (node.data.isRelayer) {
        relayers.push(node);
      }
      if (node.data.isReceiver) {
        receivers.push(node);
      }
    });
  let messagesRequests: Promise<boolean>[] = [];
  senders.flatMap(sender => {
      return receivers.flatMap(receiver => {
        return relayers.map(relayer => { return { sender, relayer, receiver }; });
    })
  })
  .filter((route) =>
    route.sender.nativeAddress !== route.receiver.nativeAddress &&
    route.sender.nativeAddress !== route.relayer.nativeAddress &&
    route.relayer.nativeAddress !== route.receiver.nativeAddress
  )
  .forEach( (route) => {
    messagesRequests.push(route.sender.sendMessage(route.receiver));
  });

  const messagesSent: boolean[] = await Promise.all(messagesRequests);
  const failedMessages = messagesSent.filter((messageSent: boolean) => !messageSent).length;
  if (failedMessages > 0) {
    throw new Error(`Failed to send ${failedMessages} messages`);
  }
}

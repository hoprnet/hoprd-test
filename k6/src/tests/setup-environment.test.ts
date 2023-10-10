import { HoprSDK } from '@hoprnet/hopr-sdk';
import { BasePayloadType, GetChannelsResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from '../api';

// Define Node class
class Node {

  public data: any;
  private basePayload: BasePayloadType
  private sdk: HoprSDK;
  public peerAddress?: string;
  public channels?: GetChannelsResponseType


  constructor(data: any) {
    this.data = data
    const apiToken = data.apiToken || process.env.HOPRD_API_TOKEN

    this.sdk = new HoprSDK({ apiEndpoint: data.url, apiToken });
    this.basePayload = { apiEndpoint: data.url, apiToken}
    this.sdk.api.account.getAddresses().then( addresses => this.peerAddress = addresses.native )
    this.sdk.api.channels.getChannels(this.basePayload).then(channels => this.channels = channels)
  }

  public async check(): Promise<boolean> {
    return await this.checkBalance() == true && await this.checkConnectivity() == true
  }

  // Check balance
  private async checkBalance(): Promise<boolean> {
    const balance = await this.api.account.getBalances(this.basePayload)
    if ((Number(balance.native) / Math.pow(10, TOKEN_DECIMALS)) < TOKEN_NATIVE_MIN) {
      console.error(`Node '${this.data.name} does not have enough native tokens (current balance is ${balance.native})`)
      return false
    }
    return true
  }

  private async checkConnectivity(): Promise<boolean>  {
    // Check connectivity
    const nodeInfo: GetInfoResponseType = await this.api.node.getInfo(this.basePayload)
    if (nodeInfo.connectivityStatus !== ConnectivityStatus.Green) {
      console.error(`Node '${this.data.name} does not have high quality connectivity (${nodeInfo.connectivityStatus})`)
      return false
    }
    return true
  }

  public async openChannels(): Promise<string[]> {
    const pendingTransactions: string[] = []
    this.data.routes.forEach((route: {name: string}) => {
      const routePeerAddress = getPeerAddressByNodeName(route.name)
      //let incommingChannels: string[] = node.channels.incoming.map((channel) => channel.peerAddress)
      //console.log(`Comparing peerId[${peerAddress}] with current incommingChannels[${incommingChannels}]`)
      const channel = this.channels?.incoming.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress )
      if (! channel) {
        console.log(`[Setup] Openning incomming channel from ${this.data.name} [${this.peerAddress}] to ${route.name} [${routePeerAddress}]`)
        this.api.channels.openChannel(Object.assign(this.basePayload, {peerAddress: routePeerAddress, amount: "100000000000000000"}))
        .then(newChannel => pendingTransactions.push(newChannel.transactionReceipt))
      }
    })
    return pendingTransactions
  }
}

// 1. Initialise variables
const environmentName = process.env.ENVIRONMENT_NAME || 'local'
const nodesData = JSON.parse(open(`./nodes-${environmentName}.json`))
const nodes: Node[]= nodesData.nodes.map((node: any) => new Node(node));
const getPeerAddressByNodeName = (nodeName: string): string => { return nodes.find((node: Node) => node.data.name == nodeName)?.peerAddress || ''}





// 4. Check nodes
const checkNodes: Promise<boolean> [] = []
nodes.forEach((node:Node) => { checkNodes.push(node.check())})
Promise.all(checkNodes).then((results: boolean[]) => {
  if (results.filter(result => ! result).length != 0) {
    console.error(`Review the previous errors checking nodes`)
    process.exit(1);
  }
})

// 4. Open channels nodes
const openChannels: Promise<string[]> [] = []
nodes.forEach((node:Node) => { openChannels.push(node.openChannels())})

Promise.all(openChannels).then((nodePendingTransactions: string[][]) => {
  const pendingTransactions = nodePendingTransactions.flat()
  console.log(`Waiting for ${pendingTransactions.length}`)
})


import { HoprSDK, BasePayloadType, GetChannelsResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from '../api/hoprd.types';
import * as fs from 'fs';

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
    if (apiToken === undefined){
        console.error('[ERROR] HOPRD_API_TOKEN environment variable not defined')
        console.error('[ERROR] export HOPRD_API_TOKEN=XXXX')
        process.exit(1);
    }
    this.basePayload = { apiEndpoint: data.url, apiToken}
    this.sdk = new HoprSDK(this.basePayload);
    this.init()
  }

  private async init() {
    this.peerAddress= (await this.sdk.api.account.getAddresses(this.basePayload)).native
    this.channels = await this.sdk.api.channels.getChannels(this.basePayload)
  }

  public async check(): Promise<boolean> {
    return await this.checkBalance() == true && await this.checkConnectivity() == true
  }

  // Check balance
  private async checkBalance(): Promise<boolean> {
    const balance = await this.sdk.api.account.getBalances(this.basePayload)
    if ((Number(balance.native) / Math.pow(10, TOKEN_DECIMALS)) < TOKEN_NATIVE_MIN) {
      console.error(`Node '${this.data.name} does not have enough native tokens (current balance is ${balance.native})`)
      return false
    }
    return true
  }

  // Check connectivity
  private async checkConnectivity(): Promise<boolean>  {
  return this.sdk.api.node.getInfo(this.basePayload)
    .then((nodeInfo: GetInfoResponseType) => {
      if (nodeInfo.connectivityStatus !== ConnectivityStatus.Green) {
        console.error(`Node '${this.data.name} does not have high quality connectivity (${nodeInfo.connectivityStatus})`)
        return false
      }
      console.log(`[INFO] Node ${this.data.name} is healthy`)
      return true
    })
    .catch(() => {
      console.error(`[ERROR] Node ${this.data.name} is not yet synchronised`)
      return false
    })

  }

  public async openChannels(): Promise<string[]> {
    const pendingChannels: Promise<{ channelId: string; transactionReceipt: string; }>[] = []
    for (let index = 0; index < this.data.routes.length; index++) {
      const route = this.data.routes[index];
      const routePeerAddress = getPeerAddressByNodeName(route.name)
      const channel = this.channels?.outgoing.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress )
      if (! channel) {
        pendingChannels.push(this.sdk.api.channels.openChannel(Object.assign(this.basePayload, {peerAddress: routePeerAddress, amount: "100000000000000000"})).then(
        (newChannel: any) => {
          console.log(`[INFO] Openning outgoing channel[${newChannel.channelId}] from ${this.data.name} to ${route.name} on Tx: ${newChannel.transactionReceipt}`)
          return newChannel
        }))
      }
    }
    let openningChannels: string[] = (await Promise.all(pendingChannels)).map(channel => channel.channelId)
    let iteration = 0
    let channels = openningChannels
    const waitingChannels: Promise<string[]> = new Promise<string[]>( (resolve) => {
      var interval = setInterval(async () => {
          iteration++
          const currentChannels: GetChannelsResponseType = await this.sdk.api.channels.getChannels(this.basePayload)
          channels = channels.filter(channel => currentChannels.outgoing.find(outgoingChannel => outgoingChannel.id == channel && outgoingChannel.status == "Open" ) == undefined )
          if (channels.length == 0 || iteration >= 10) {
            clearInterval(interval);
            resolve(channels)
          } else {
            console.log(`[INFO] [Iteration ${iteration}] Node ${this.data.name} has pending channels : ${channels}`)
          }
        }, 60 * 1000)
    })
    return (await waitingChannels)

  }


}

const setupEnvironment = async () => {

  
  // Check nodes
  const checkNodes: Promise<boolean> [] = []
  nodes.forEach((node:Node) => { checkNodes.push(node.check())})
  await Promise.all(checkNodes).then((results: boolean[]) => {
    if (results.filter(result => ! result).length != 0) {
      console.error(`[ERROR] Review the previous errors checking nodes`)
      process.exit(1);
    }
  })

  // Open channels nodes
  const openChannels: Promise<string[]> [] = []
  nodes.forEach((node:Node) => { openChannels.push(node.openChannels())})

  const nodePendingTransactions: string[][] = await Promise.all(openChannels)
    if (nodePendingTransactions.flat().length > 0 ) {
      console.error(`[ERROR] There are ${nodePendingTransactions.flat().length} channels pending to be openned`)
      process.exit(1);
    }
}

// Main
const environmentName = process.env.ENVIRONMENT_NAME || 'local'
const nodesData = JSON.parse(fs.readFileSync(`dist/nodes-${environmentName}.json`).toString())
const nodes: Node[]= nodesData.nodes.map((node: any) => new Node(node));
const getPeerAddressByNodeName = (nodeName: string): string => { return nodes.find((node: Node) => node.data.name == nodeName)?.peerAddress || ''}

setupEnvironment().then(() => {
  console.log('Environment fully setup')
}).catch((err) => console.error(err))

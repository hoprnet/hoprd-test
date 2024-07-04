import { GetChannelsResponseType, GetInfoResponseType, HoprSDK } from "@hoprnet/hopr-sdk";
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from "./hoprd.types";

export class HoprdNode {

  public data: any;
  private basePayload: {
        apiEndpoint: string;
        apiToken: string;
        timeout?: number;
    };
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
    this.basePayload = { apiEndpoint: data.url as string, apiToken}
    this.sdk = new HoprSDK(this.basePayload);
    this.init();
  }

  public async init() {
    await this.sdk.api.account.getAddresses(this.basePayload).then((addresses) => {
      this.peerAddress = addresses.native;
    }).catch((error: any) => {
      console.error(`[ERROR] Unable to get node peerAddress for '${this.data.name}'`)
      console.error(`[ERROR] ${error}`)
      process.exit(1);
    });
    await this.sdk.api.channels.getChannels(this.basePayload).then((channels) => {
     this.channels = channels;
    }).catch((error: any) => {
      console.error(`[ERROR] Unable to get node channels for '${this.data.name}'`)
      console.error(`[ERROR] ${error}`)
      process.exit(1);
    });
  }

  public async check(): Promise<boolean> {
    return await this.checkBalance() == true && await this.checkConnectivity() == true
  }

  // Check balance
  private async checkBalance(): Promise<boolean> {
    return this.sdk.api.account.getBalances(this.basePayload).then((balance) => {
    if ((Number(balance.native) / Math.pow(10, TOKEN_DECIMALS)) < TOKEN_NATIVE_MIN) {
      console.error(`Node '${this.data.name} does not have enough native tokens (current balance is ${balance.native})`)
      return false
    }
    return true
    }).catch((error: any) => {
      console.error(`[ERROR] Insufficient node balance for '${this.data.name}'`)
      console.error(`[ERROR] ${error}`)
      return false

    });
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

  public async openChannels(nodes: HoprdNode[]): Promise<string[]> {
    const pendingChannels: Promise<{ channelId: string; transactionReceipt: string; }>[] = []
    const getPeerAddressByNodeName = (nodeName: string): string => { return nodes.find((node: HoprdNode) => node.data.name == nodeName)?.peerAddress || ''}
    for (let index = 0; index < this.data.routes.length; index++) {
      const route = this.data.routes[index];
      const routePeerAddress = getPeerAddressByNodeName(route.name)
      if (routePeerAddress == '') {
        console.error(`[ERROR] Unable to find peerAddress for node ${route.name} in routes for node ${this.data.name}`)
        process.exit(1);
      }
      const channel = this.channels?.outgoing.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress )
      if (! channel) {
        let openChannelPayload = Object.assign(this.basePayload, {peerAddress: routePeerAddress, amount: "100000000000000000", timeout: 1000 * 60 * 3 });
        //console.log(`[INFO] Openning outgoing channel from ${this.data.name} with payload ${JSON.stringify(openChannelPayload)}`)
        pendingChannels.push(this.sdk.api.channels.openChannel(openChannelPayload).then(
        (newChannel: any) => {
          console.log(`[INFO] Openning outgoing channel[${newChannel.channelId}] from ${this.data.name} to ${route.name} on Tx: ${newChannel.transactionReceipt}`)
          return newChannel
        }).catch((error: any) => {
          console.error(`[ERROR] Unable to open outgoing channel from ${this.data.name} to ${route.name}`)
          console.error(`[ERROR] ${error}`)
        })
      )
      } else {
        if (channel.status != 'Open') {
          console.error(`[ERROR] Channel from ${this.data.name} to ${route.name} is in status ${channel.status} and cannot be used. Please close it manually.`)
          process.exit(1);
        }
        if (BigInt(channel.balance) < BigInt(10000000000000000)) {
          console.error(`[ERROR] Channel (${channel.id}) balance from ${this.data.name} to ${route.name} is insufficient and cannot be used. Please top up manually the channel or close it.`)
          process.exit(1);
        }
        //console.log(`[DEBUG] Channel from ${this.data.name} to ${route.name} already openened with id ${channel.id}`)
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
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
  public nativeAddress?: string;
  public peerId?: string;
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
      this.nativeAddress = addresses.native;
      this.peerId = addresses.hopr
    }).catch((error: any) => {
      console.error(`[ERROR] Unable to get node peerAddress for '${this.data.name}'`)
      console.error("[ERROR]", error)
      process.exit(1);
    });
    await this.sdk.api.channels.getChannels(this.basePayload).then((channels) => {
     this.channels = channels;
    }).catch((error: any) => {
      console.error(`[ERROR] Unable to get node channels for '${this.data.name}'`)
      console.error("[ERROR]", error)
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
      console.error("[ERROR]", error)
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

  public async openChannel(peerAddress: string, nodeName: string): Promise<string> {
    if (peerAddress == '') {
      console.error(`[ERROR] Unable to find peer address for node '${nodeName}' in routes for node ${this.data.name}`)
      throw new Error(`Peer address not found for node '${nodeName}'`);
    }
    const openChannelPayload = Object.assign(this.basePayload, {peerAddress, amount: "100000000000000000", timeout: 1000 * 60 * 3 });
    return this.sdk.api.channels.openChannel(openChannelPayload).then(
      (newChannel: any) => {
        console.log(`[INFO] Openning outgoing channel from ${this.data.name} to ${nodeName} on Tx: ${newChannel.transactionReceipt}`);
        return newChannel.channelId;
      }).catch((error: any) => {
        console.error(`[ERROR] Unable to open outgoing channel from ${this.data.name} to ${nodeName}`);
        console.error(`[ERROR]`, error);
        throw error;
      })
  }

  public async closeChannel(channelId: string): Promise<void> {
    const closeChannelPayload = Object.assign(this.basePayload, {channelId, timeout: 1000 * 60 * 5 });
    console.log(`[INFO] Closing outgoing channel ${channelId} from ${this.data.name}`)
    return this.sdk.api.channels.closeChannel(closeChannelPayload).then(
      (closeChannel: any) => {
        console.log(`[INFO] Closing outgoing channel ${closeChannel.channelId} from ${this.data.name}`)
      }).catch((error: any) => {
        console.error(`[ERROR] Unable to close outgoing channel from ${this.data.name} with channelId ${channelId}`)
        console.error("[ERROR]", error)
      })
  }

  public async syncChannels(nodes: HoprdNode[]): Promise<string[]> {
    const pendingOpenChannels: Promise<string> [] = []
    const pendingCloseChannels: Promise<void> [] = []
    // Prepare to open channels
    for (let route of this.data.routes) {
      const routePeerAddress = this.getNativeAddressByNodeName(route.name, nodes)
      if (routePeerAddress == '') {
        console.error(`[ERROR] Unable to find peerAddress for node ${route.name} in routes for node ${this.data.name}`)
        process.exit(1);
      }
      const channel = this.channels?.outgoing.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress )
      if (! channel) {
        pendingOpenChannels.push(this.openChannel(routePeerAddress, route.name))
      } else {
        if (channel.status != 'Open') {
          console.error(`[ERROR] Channel from ${this.data.name} to ${route.name} is in status ${channel.status} and cannot be used. Please close it manually.`)
          process.exit(1);
        }
        if (BigInt(channel.balance) < BigInt(10000000000000000)) {
          console.warn(`[WARN] Channel (${channel.id}) balance from ${this.data.name} to ${route.name} is insufficient and cannot be used. Funding it automatically.`)
          await this.sdk.api.channels.fundChannel(Object.assign(this.basePayload, {channelId: channel.id, amount: "10000000000000000" }))
          .catch((error: any) => {
              console.error(`[ERROR] Unable to fund channel ${channel.id} from ${this.data.name}`);
              console.error("[ERROR]", error);
          });
        }
      }
    }
    // Prepare to close channels
    const channelsToClose = await this.getOutgoingChannelsToClose(nodes);
    channelsToClose.forEach((channelId) => {
      console.log(`[INFO] Closing outgoing channel ${channelId} from ${this.data.name}`);
      pendingCloseChannels.push(this.closeChannel(channelId));
    });


    // Open and close channels
    let openningChannels: string[] = (await Promise.all(pendingOpenChannels));
    await Promise.all(pendingCloseChannels);

    // Wait for channels to be openned and closed
    let waitForChannels = [...openningChannels.map(openningChannel => this.waitForChannelStatus(openningChannel, 'Open')), ...(await channelsToClose).map(channelToClose => this.waitForChannelStatus(channelToClose, 'Closed'))];
    return Promise.all(waitForChannels);
  }

  getNativeAddressByNodeName(nodeName: string, nodes: HoprdNode[]): string {
    let node: HoprdNode | undefined = nodes.find((node: HoprdNode) => node.data.name === nodeName );
    return node?.nativeAddress || '';
  }

  public async getOutgoingChannelsToClose(nodes: HoprdNode[]): Promise<string[]> {
    const currentChannels: GetChannelsResponseType = await this.sdk.api.channels.getChannels(this.basePayload)
    const outgoingNativeAddressNodes: string[] = this.data.routes.map((route: any) => this.getNativeAddressByNodeName(route.name, nodes));
    const channelsToClose = currentChannels.outgoing.filter((outgoingChannel) => {
      //console.log(`[INFO] Checking channel ${outgoingChannel.id} from ${this.data.name} to ${outgoingChannel.peerAddress}`)
      //console.log(`[INFO] Is about to close: ${!outgoingNativeAddressNodes.includes(outgoingChannel.peerAddress) && outgoingChannel.status === 'Open'}`)
      return !outgoingNativeAddressNodes.includes(outgoingChannel.peerAddress) && outgoingChannel.status === 'Open'
    }).map((outgoingChannel) => outgoingChannel.id)
    return channelsToClose;
  }

  async waitForChannelStatus(channelId: string, desiredStatus: string): Promise<string> {
    let iteration = 0;
    const maxIterations = 10;
    let channel = channelId;
    const waitingChannel: Promise<string> = new Promise<string>( (resolve, reject) => {
      var interval = setInterval(async () => {
          iteration++
          const currentChannels: GetChannelsResponseType = await this.sdk.api.channels.getChannels(this.basePayload)
          const channelStatus = currentChannels.outgoing.find(outgoingChannel => outgoingChannel.id == channel )
         if (channelStatus?.status == desiredStatus) {
           clearInterval(interval);
           resolve(channel);
         } else if (iteration >= maxIterations) {
           clearInterval(interval);
           reject(new Error(`Channel ${channel} did not reach status ${desiredStatus} after ${iteration} iterations.`));
         } else {
           console.log(`[INFO] [Iteration ${iteration}] Node ${this.data.name} has '${channelStatus?.status}' channel : ${channel}`);
         }
        }, 60 * 1000)
    })
    return (await waitingChannel)
  }
}
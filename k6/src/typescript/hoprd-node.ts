import { GetChannelsResponseType, GetInfoResponseType, HoprSDK } from "@hoprnet/hopr-sdk";
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from "./hoprd.types";
import WebSocket from "ws";

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
    if (apiToken === undefined) {
      console.error('[ERROR] HOPRD_API_TOKEN environment variable not defined')
      console.error('[ERROR] export HOPRD_API_TOKEN=XXXX')
      process.exit(1);
    }
    this.basePayload = { apiEndpoint: data.url as string, apiToken }
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
      throw error
    });
    await this.sdk.api.channels.getChannels(this.basePayload).then((channels) => {
      this.channels = channels;
    }).catch((error: any) => {
      console.error(`[ERROR] Unable to get node channels for '${this.data.name}'`)
      console.error("[ERROR]", error)
      throw error
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
  private async checkConnectivity(): Promise<boolean> {
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

  public async openChannel(peerAddress: string, nodeName: string): Promise<{ channelId: string, targetNode: string, desiredStatus: string }> {
    if (peerAddress == '') {
      console.error(`[ERROR] Unable to find peer address for node '${nodeName}' in routes for node ${this.data.name}`)
      throw new Error(`Peer address not found for node '${nodeName}'`);
    }
    const openChannelPayload = Object.assign(this.basePayload, { peerAddress, amount: "100000000000000000", timeout: 1000 * 60 * 3 });
    console.log(`[INFO] Openning outgoing channel from ${this.data.name} to ${nodeName} with payload ${JSON.stringify(openChannelPayload)}`)
    return this.sdk.api.channels.openChannel(openChannelPayload).then(
      (newChannel: any) => {
        console.log(`[INFO] Openned outgoing channel from ${this.data.name} to ${nodeName} on Tx: ${newChannel.transactionReceipt}`);
        return { channelId: newChannel.channelId, targetNode: nodeName, desiredStatus: 'Open' };
      }).catch((error: any) => {
        console.error(`[ERROR] Unable to open outgoing channel from ${this.data.name} to ${nodeName}`);
        console.error(`[ERROR]`, error);
        throw error;
      })
  }

  public async closeChannel(channelId: string, targetNode: string): Promise<{ channelId: string, targetNode: string, desiredStatus: string }> {
    const closeChannelPayload = Object.assign(this.basePayload, { channelId, timeout: 1000 * 60 * 5 });
    return this.sdk.api.channels.closeChannel(closeChannelPayload).then(
      (closeChannel: any) => {
        console.log(`[INFO] Closed outgoing channel ${closeChannel.receipt} from ${this.data.name}`)
        return { channelId, targetNode, desiredStatus: 'Closed' };
      }).catch((error: any) => {
        console.error(`[ERROR] Unable to close outgoing channel from ${this.data.name} with channelId ${channelId}`)
        console.error("[ERROR]", error)
        throw error;
      })
  }

  private async getChannelsToOpen(nodes: HoprdNode[], channelsToOpen: Promise<{ channelId: string, targetNode: string, desiredStatus: string }>[]) {
    // Prepare to open channels
    for (let route of this.data.routes) {
      // console.log(`[INFO] Checking channel from ${this.data.name} to ${route.name}`)
      const routePeerAddress = this.getNativeAddressByNodeName(route.name, nodes)
      if (routePeerAddress == '') {
        console.error(`[ERROR] Unable to find peerAddress for node ${route.name} in routes for node ${this.data.name}`)
        process.exit(1);
      }
      const channel = this.channels?.outgoing.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress)
      if (!channel) {
        console.log(`[INFO] Channel from ${this.data.name} to ${route.name} does not exist. Openning it automatically.`)
        channelsToOpen.push(this.openChannel(routePeerAddress, route.name));
      } else {
        // console.log(`[INFO] Channel from ${this.data.name} already ${route.name} exists`)
        if (channel.status != 'Open') {
          console.error(`[ERROR] Channel from ${this.data.name} to ${route.name} is in status ${channel.status} and cannot be used. Please close it manually.`)
          process.exit(1);
        }
        if (BigInt(channel.balance) < BigInt(10000000000000000)) {
          console.warn(`[WARN] Channel (${channel.id}) balance from ${this.data.name} to ${route.name} is insufficient and cannot be used. Funding it automatically.`)
          await this.sdk.api.channels.fundChannel(Object.assign(this.basePayload, { channelId: channel.id, amount: "10000000000000000", timeout: 1000 * 60 * 3 }))
            .catch((error: any) => {
              console.error(`[ERROR] Unable to fund channel ${channel.id} from ${this.data.name}`);
              console.error("[ERROR]", error);
            });
        }
      }
    }
  }

  private async getChannelsToClose(nodes: HoprdNode[], channelsToClose: Promise<{ channelId: string, targetNode: string, desiredStatus: string }>[]) {
    const currentChannels: GetChannelsResponseType = await this.sdk.api.channels.getChannels(this.basePayload)
    const outgoingNativeAddressNodes: string[] = this.data.routes.map((route: any) => this.getNativeAddressByNodeName(route.name, nodes));
    currentChannels.outgoing.filter((outgoingChannel) => {
      // console.log(`[INFO] Checking channel ${outgoingChannel.id} from ${this.data.name} to ${this.getNameByNativeAddress(outgoingChannel.peerAddress, nodes)}`)
      // console.log(`[INFO] Does the channel belong to an existing route: ${outgoingNativeAddressNodes.includes(outgoingChannel.peerAddress)}`)
      // console.log(`[INFO] Is the channel Open: ${outgoingChannel.status === 'Open'}`)
      return !outgoingNativeAddressNodes.includes(outgoingChannel.peerAddress) && outgoingChannel.status === 'Open'
    })
      .forEach((outgoingChannel) => {
        const targetNode = this.getNameByNativeAddress(outgoingChannel.peerAddress, nodes);
        console.log(`[INFO] Closing outgoing channel ${outgoingChannel.id} from ${this.data.name} to ${targetNode}`);
        channelsToClose.push(this.closeChannel(outgoingChannel.id, targetNode));
      });
    return channelsToClose;
  }

  public async syncChannels(nodes: HoprdNode[]): Promise<string[]> {
    // Get channels to open and close
    const channelsToChange: Promise<{ channelId: string, targetNode: string, desiredStatus: string }>[] = []
    await this.getChannelsToOpen(nodes, channelsToChange);
    await this.getChannelsToClose(nodes, channelsToChange);

    // Open and close channels
    const channelsChanges: { channelId: string, targetNode: string, desiredStatus: string }[] = await Promise.all(channelsToChange)

    // Wait for channels to reach desired status
    return Promise.all(channelsChanges.map(async (channelChange) => await this.waitForChannelStatus(channelChange)));
  }

  getNativeAddressByNodeName(nodeName: string, nodes: HoprdNode[]): string {
    let node: HoprdNode | undefined = nodes.find((node: HoprdNode) => node.data.name === nodeName);
    return node?.nativeAddress || '';
  }

  getNameByNativeAddress(nativeAddress: string, nodes: HoprdNode[]): string {
    let node: HoprdNode | undefined = nodes.find((node: HoprdNode) => node.nativeAddress === nativeAddress);
    return node?.data.name;
  }


  async waitForChannelStatus(channel: { channelId: string, targetNode: string, desiredStatus: string }): Promise<string> {
    let iteration = 0;
    const maxIterations = 15;
    const waitingChannel: Promise<string> = new Promise<string>((resolve, reject) => {
      var interval = setInterval(async () => {
        iteration++
        const currentChannels: GetChannelsResponseType = await this.sdk.api.channels.getChannels(this.basePayload)
        const channelStatus = currentChannels.outgoing.find(outgoingChannel => outgoingChannel.id == channel.channelId)
        if (channelStatus?.status == undefined || channelStatus?.status == channel.desiredStatus) {
          clearInterval(interval);
          resolve(channel.channelId);
        } else if (iteration >= maxIterations) {
          clearInterval(interval);
          reject(new Error(`Channel ${channel} did not reach status ${channel.desiredStatus} after ${iteration} iterations.`));
        } else {
          console.log(`[INFO] [Iteration ${iteration}] Node ${this.data.name} has '${channelStatus?.status}' channel : ${channel.channelId}`);
        }
      }, 60 * 1000)
    })
    return (await waitingChannel)
  }

  public async sendMessage(relayer: HoprdNode, receiver: HoprdNode): Promise<boolean> {
    let url = this.basePayload.apiEndpoint.replace("http", "ws") + '/api/v3/session/websocket?';
    url += 'capabilities=Segmentation&capabilities=Retransmission&';
    url += `target=echo-service-http.staging.hoprnet.link:80&`;
    url += `hops=1&`;
    url += `IntermediatePath=${relayer.peerId}&`;
    url += `destination=${receiver.peerId}&`;
    url += 'protocol=tcp';
    url += '&apiToken=' + this.basePayload.apiToken;
    const ws = new WebSocket(url);
    let messagePayload = this.stringToArrayBuffer(`GET /?startTime=${Date.now()} HTTP/1.1\r\nHost: echo-service-http.staging.hoprnet.link\r\n\r\n`);
    let sender = this.data.name;
    let sent = false;

    return new Promise((resolve, reject) => {
      // Event: Connection open
      ws.onopen = function open() {
        //console.log(`Open websocket connection, sender=${sender}, relayer=${relayer.data.name}, receiver=${receiver.data.name}`);
        ws.send(messagePayload);
      };

      // Event: Message received from the server
      ws.onmessage = function incoming(event: any) {
        if (event.data instanceof Buffer) {
          sent = true;
          console.log(`[INFO] Route sender=${sender}, relayer=${relayer.data.name}, receiver=${receiver.data.name} works`);
          resolve(true);
        } else {
          console.error(`Message failed, sender=${sender}, relayer=${relayer.data.name}, receiver=${receiver.data.name}`);
          resolve(false);
        }
        ws.close(); // Close connection after receiving the response
      };

      // Event: Error
      ws.onerror = function error(error: any) {
        console.error(`Message failed, sender=${sender}, relayer=${relayer.data.name}, receiver=${receiver.data.name}`);
        console.error("WebSocket error:", error);
        resolve(false);
      };

      // Event: Connection closed
      ws.onclose = function close() {
        
      };

      setTimeout(() => {
        if (!sent) {
          console.error(`Could not send message, sender=${sender}, relayer=${relayer.data.name}, receiver=${receiver.data.name}`);
          reject(false);
          ws.close();
        }
      }, 5000);
    });
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length);
    const bufferView = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      bufferView[i] = str.charCodeAt(i);
    }
    return buffer;
  }

}
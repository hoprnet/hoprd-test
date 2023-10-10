// import { AccountAdapter } from '@hoprnet/hopr-sdk/dist/api/account/adapter'
import { check, fail } from 'k6'
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from '../api/hoprd.types'

import {
  AccountApi,
  ChannelsApi,
  NodeApi
} from '../api/index'
import { GetAddressesResponseType, GetChannelsResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk'
import { RefinedParams } from 'k6/http'


export class HoprdNode {
  public name: string
  public url: string
  public apiToken: string
  public isSender?: boolean
  public peerAddress?: string
  public peerId?: string
  public routes?: {name: string}[]
  public channels?: GetChannelsResponseType

  // public httpParams: RefinedParams<ResponseType> = {}




  public constructor(data: any) {
    this.name = data.name
    this.url = data.url
    this.apiToken = data.apiToken


    // const account: AccountAdapter = new AccountAdapter({ apiEndpoint: data.url, apiToken: data.apiToken})

    // this.isSender = data.isSender || true
    // this.routes = data.routes

    // this.httpParams = {
    //   headers: {
    //     'x-auth-token': this.apiToken,
    //     'Content-Type': 'application/json'
    //   },
    //   tags: {
    //     node_name: this.name,
    //   }
    // }
    // const addresses: GetAddressesResponseType = (new AccountApi(this)).getAddresses()
    // this.peerAddress = addresses.native
    // this.peerId = addresses.hopr
    // this.checkBalance()
    // this.checkConnectivity()
    // this.channels = (new ChannelsApi(this)).getChannels()
  }


  private checkBalance() {
    const balance = (new AccountApi(this)).getBalance()
    if ((Number(balance.native) / Math.pow(10, TOKEN_DECIMALS)) < TOKEN_NATIVE_MIN) {
      fail(`Node '${this.name} does not have enough native tokens (current balance is ${balance.native})`)
    } else {
      check(balance, { 'Enough balance': (balance) => balance != undefined })
    }
  }

  private checkConnectivity() {
    // Get connectivity
    const nodeInfo: GetInfoResponseType = (new NodeApi(this)).getInfo()
    if (!check(nodeInfo, {
        'Node has green connectivity': (ni: GetInfoResponseType) => ni.connectivityStatus === ConnectivityStatus.Green
      })
    ) {
      fail(`Node '${this.name}' is not in green network connectivity`)
    }
  }


  public openChannel(peerAddress: string): void {
    (new ChannelsApi(this)).openChannel(peerAddress, "100000000000000000");
  }

}

import { RefinedParams, ResponseType } from 'k6/http'
import { ConnectivityStatus, TOKEN_DECIMALS, TOKEN_NATIVE_MIN } from '../api/hoprd.types'

import {
  AccountApi,
  ChannelsApi,
  MesssagesApi,
  NodeApi
} from '../api/index'
import { GetAddressesResponseType, GetChannelsResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk'
import { check, fail } from 'k6'
import { Counter } from 'k6/metrics'

export class HoprdNode {
  public name: string
  public url: string
  public apiToken: string
  public isSender: boolean
  public peerAddress: string
  public peerId: string
  public routes: {name: string}[]
  public channels: GetChannelsResponseType

  public httpParams: RefinedParams<ResponseType> = {}




  public constructor(data: any) {
    this.name = data.name
    this.url = data.url
    this.apiToken = data.apiToken
    this.isSender = data.isSender || true
    this.routes = data.routes

    this.httpParams = {
      headers: {
        'x-auth-token': this.apiToken,
        'Content-Type': 'application/json'
      },
      tags: {
        node_name: this.name,
      }
    }
    const addresses: GetAddressesResponseType = (new AccountApi(this)).getAddresses()
    this.peerAddress = addresses.native
    this.peerId = addresses.hopr
    check(this.peerAddress, { 'Node is running' : (peerAddress) => peerAddress != undefined })
    this.checkHealth()
    this.channels = (new ChannelsApi(this)).getChannels()
  }

  private checkHealth() {
    // Check the node is running by making simple API get query
    

    // Check node balance
    this.checkBalance()

    this.checkConnectivity()
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

  public sendHopMessage(hops: number, peerId: string, successCounter: Counter, failedCounter: Counter) {
    const messageApi = new MesssagesApi(this)
    messageApi.sendMessage(JSON.stringify({ body: randomString(15), peerId, hops }), successCounter, failedCounter)
  }

}

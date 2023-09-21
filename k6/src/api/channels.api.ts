import http, { RefinedResponse } from 'k6/http'

import { HoprdNode } from '../types/hoprd-node'
import { check, fail } from 'k6'
import { GetChannelsResponseType, OpenChannelResponseType } from '@hoprnet/hopr-sdk'

/**
 * Wrap Channels API
 */
export class ChannelsApi {

  protected node: HoprdNode

  public constructor(node: HoprdNode) {
    this.node = node
  }

  /**
   * Invoke API Rest call for getting node channels
   * @returns incomming and outgoing channels
   */
  public getChannels(): GetChannelsResponseType {
    const response: RefinedResponse<'text'> = http.get(`${this.node.url}/channels`, this.node.httpParams)

    if (response.status === 200) {
      const channels: GetChannelsResponseType = JSON.parse(response.body)
      return channels
    } else {
      fail(`Unable to get node channels '${this.node.name}'`)
    }
  }

  /**
   * Invoke API Rest call for open node channels
   * @returns Openned channel
   */
  public openChannel(peerAddress: string, amount: string): OpenChannelResponseType {
    // console.log(`Sending message ${JSON.stringify(messageRequest)}`)

    const response: RefinedResponse<'text'> = http.post(
      `${this.node.url}/channels`,
      JSON.stringify({peerAddress, amount}),
      this.node.httpParams
    )

    if (check(response, { 'channel opened': (r) => r.status === 201 })) {
      const openChannel: OpenChannelResponseType = JSON.parse(response.body)
      return openChannel
    } else {
      fail(`Unable to open channel from ${this.node.name} to ${peerAddress}`)
    }
  }

}

import http, { RefinedResponse } from 'k6/http'

import { HoprdNode } from '../types/hoprd-node'
import { fail } from 'k6'
import { GetInfoResponseType } from '@hoprnet/hopr-sdk'

/**
 * Wrap Node API
 */
export class NodeApi {
  protected node: HoprdNode

  public constructor(node: HoprdNode) {
    this.node = node
  }

  /**
   * Invoke API Rest call for getting the current status of the node
   * @returns NodeInfo
   */
  public getInfo(): GetInfoResponseType {
    const response: RefinedResponse<'text'> = http.get(`${this.node.url}/node/info`, this.node.httpParams)
    if (response.status === 200) {
      const nodeInfo: GetInfoResponseType = JSON.parse(response.body)
      return nodeInfo
    } else {
      fail(`Unable to get node info for '${this.node.name}'s`)
    }
    
  }

}

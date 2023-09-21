import http, { RefinedResponse } from 'k6/http'

import { HoprdNode } from '../types/hoprd-node'
import { fail } from 'k6'
import { GetAddressesResponseType, GetBalancesResponseType } from '@hoprnet/hopr-sdk'


/**
 * Wrap Account API
 */
export class AccountApi {

  protected node: HoprdNode

  public constructor(node: HoprdNode) {
    this.node = node
  }

  /**
   * Invoke API Rest call for getting node addresses
   * @returns addresses
   */
  public getAddresses(): GetAddressesResponseType  {
    const response: RefinedResponse<'text'> = http.get(`${this.node.url}/account/addresses`, this.node.httpParams)
    if (response.status === 200) {
      const addresses: GetAddressesResponseType = JSON.parse(response.body)
      //console.log(`Hopr address for node '${this.node.name} is' ${addresses.hopr}`)
      //console.log(`Native address for node '${this.node.name} is' ${addresses.native}`)
      return addresses
    } else {
      fail(`Unable to get node addresses for '${this.node.name}'`)
    } 
  }

  /**
   * Invoke API Rest call for getting node balance
   * @returns balance
   */
  public getBalance(): GetBalancesResponseType {
    const response: RefinedResponse<'text'> = http.get(`${this.node.url}/account/balances`, this.node.httpParams)
    if (response.status === 200) {
      const balance: GetBalancesResponseType = JSON.parse(response.body);
      //console.log(`Hopr balance for node '${this.node.name} is' ${balance.hopr}`)
      //console.log(`Native balance for node '${this.node.name} is' ${balance.native}`)
      return balance;
    } else {
      console.error(response.body)
      fail(`Unable to get node balance for '${this.node.name}'`)
    }
  }
    
}

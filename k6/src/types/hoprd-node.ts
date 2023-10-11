import { GetAddressesResponseType } from '@hoprnet/hopr-sdk'
import { fail } from 'k6'
import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'

export class HoprdNode {
  public name: string
  public url: string
  public apiToken: string
  public isSender: boolean
  public peerAddress?: string
  public peerId?: string

  public httpParams: RefinedParams<ResponseType> = {}

  public constructor(data: any) {
    this.name = data.name
    this.url = data.url
    this.isSender = data.isSender
    this.apiToken = data.apiToken
    this.httpParams = {
      headers: {
        'x-auth-token': this.apiToken,
        'Content-Type': 'application/json'
      },
      tags: {
        node_name: this.name,
      }
    }
    this.getAddresses()
  }

   
  /**
   * Invoke API Rest call for getting node addresses
   * @returns addresses
   */
  private getAddresses(): GetAddressesResponseType  {
    const response: RefinedResponse<'text'> = http.get(`${this.url}/account/addresses`, this.httpParams)
    if (response.status === 200) {
      const addresses: GetAddressesResponseType = JSON.parse(response.body)
      this.peerAddress = addresses.native
      this.peerId = addresses.hopr
      //console.log(`Hopr address for node '${this.node.name} is' ${addresses.hopr}`)
      //console.log(`Native address for node '${this.node.name} is' ${addresses.native}`)
      return addresses
    } else {
      fail(`Unable to get node addresses for '${this.name}'`)
    } 
  }


}

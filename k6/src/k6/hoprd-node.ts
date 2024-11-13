import http, { RefinedParams, RefinedResponse, ResponseType } from "k6/http";
import { fail } from "k6";

// This class cannot implement async methods as it is used in the k6 script
export class HoprdNode {
  public name: string;
  public url: string;
  public enabled: boolean;
  public isSender: boolean;
  public isRelayer: boolean;
  public isReceiver: boolean;
  public peerAddress: string;
  public httpParams: RefinedParams<ResponseType>;
  public peerId: string;

  constructor(data) {
    this.name = data.name;
    this.url = data.url;
    (this.httpParams = {
      headers: {
        "x-auth-token": data.apiToken,
        "Content-Type": "application/json",
      },
      tags: {
        node_name: data.name,
        name: data.name,
      },
    }),
      (this.enabled = data.enabled),
      (this.isSender = data.isSender),
      (this.isRelayer = data.isRelayer),
      (this.isReceiver = data.isReceiver);
    this.getAddress(data);
  }

  private getAddress(data) {
    const httpParams = {
      headers: {
        "x-auth-token": data.apiToken,
        "Content-Type": "application/json",
      },
      tags: {
        name: "init_test",
      },
    };
    const response: RefinedResponse<"text"> = http.get(`${this.url}/account/addresses`,httpParams);
    if (response.status === 200) {
      const addresses = JSON.parse(response.body);
      this.peerAddress = addresses.native;
      this.peerId = addresses.hopr;
    } else {
      console.error(`Response: ${JSON.parse(response.body)}`);
      console.error(`Response status: ${response.status}`);
      fail(`Unable to get node addresses for '${this.name}'`);
    }
  }
}
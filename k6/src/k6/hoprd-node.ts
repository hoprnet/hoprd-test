import http, { RefinedParams, RefinedResponse, ResponseType } from "k6/http";
import { fail } from "k6";

// This class cannot implement async methods as it is used in the k6 script
export class HoprdNode {
  public name: string;
  public nodeName: string;
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
    this.url = data.url + "/api/v3";
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
      (this.nodeName = data.instance),
      (this.isReceiver = data.isReceiver);
    this.getAddress(data.apiToken);
  }

  private getAddress(apiToken) {
    const httpParams = {
      headers: {
        "x-auth-token": apiToken,
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

  public getNetwork(): string {
    const response: RefinedResponse<"text"> = http.get(`${this.url}/node/info`,this.httpParams);
    if (response.status === 200) {
      const nodeInfo = JSON.parse(response.body);
      console.log(`[Setup] Network: ${nodeInfo.network}`);
      return nodeInfo.network;
    } else {
      console.error(`Response: ${JSON.parse(response.body)}`);
      console.error(`Response status: ${response.status}`);
      fail(`Unable to get node info for '${this.name}'`);
    }
  }

  public getVersion() {
    const response: RefinedResponse<"text"> = http.get(`${this.url}/node/version`,this.httpParams);
    if (response.status === 200) {
      const nodeVersion = JSON.parse(response.body);
      console.log(`[Setup] Version: ${nodeVersion.version}`);
      return nodeVersion.version;
    } else {
      console.error(`Response: ${JSON.parse(response.body)}`);
      console.error(`Response status: ${response.status}`);
      fail(`Unable to get node version for '${this.name}'`);
    }
  }


  public openSession(relayer: string, receiver: string, protocol: string, target: string): string {
    const url = `${this.url}/session/${protocol}`;
    const payload = JSON.stringify({
        destination: receiver,
        target: { Plain: `${target}` },
        capabilities: ["Segmentation", "Retransmission"],
        path: relayer
      });
    console.log(`Payload: ${payload}`);
    console.log(`URL: ${url}`);
    console.log(`HTTP Params: ${JSON.stringify(this.httpParams)}`);
    const response: RefinedResponse<"text"> = http.post(url, payload, this.httpParams);
    if (response.status === 200) {
      console.log(`[Setup] Session opened: ${response.body}`);
      const session = JSON.parse(response.body);
      return `${session.ip}:${session.port}`;
    } else {
      console.error(`Response: ${JSON.parse(response.body)}`);
      console.error(`Response status: ${response.status}`);
      fail(`Unable to open session for '${this.name}'`);
    }
  }
}
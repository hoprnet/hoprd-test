import http, { RefinedParams, RefinedResponse, ResponseType } from "k6/http";
import { fail } from "k6";

// This class cannot implement async methods as it is used in the k6 script
export class HoprdNode {
  public name: string;
  public nodeName: string;
  public url: string;
  public p2p: string;
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
      (this.p2p = data.p2p),
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
      console.error(`Response: ${response.body}`);
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
      console.error(`Response: ${response.body}`);
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
      console.error(`Response: ${response.body}`);
      console.error(`Response status: ${response.status}`);
      fail(`Unable to get node version for '${this.name}'`);
    }
  }


  public openSession(relayer: HoprdNode, receiver: HoprdNode, protocol: string, target: string): string {
    if (__ENV.K6_SKIP_HOPRD_SESSIONS === 'true') {
      return target;
    } else {
      const url = `${this.url}/session/${protocol}`;
      let listenHost = this.getSessionRequest(url, protocol, target);
      if (listenHost == '') {
        listenHost = this.openSessionRequest(url, relayer, receiver, target);
      }
      return listenHost;
    }
  }

  private getSessionRequest(url: string, protocol: string, target: string): string {
    const getResponse: RefinedResponse<"text"> = http.get(url, this.httpParams);
    if (getResponse.status === 200) {
      const sessions: {target: string, protocol: string, ip: string, port: number}[] = JSON.parse(getResponse.body);
      const openedSession = sessions.filter((session) => session.target == target && session.protocol == protocol)
      //console.log(`[Setup] Opened sessions: ${JSON.stringify(openedSession)}`);
      if (openedSession.length == 1) {
        let listenHost;
        if (openedSession[0].ip === '0.0.0.0') { // In Kubernetes
          listenHost=`${this.p2p}:${openedSession[0].port}`;
        } else {
          listenHost = `${openedSession[0].ip}:${openedSession[0].port}`;
        }
        console.log(`[Setup] Session already openened at: ${listenHost} to target ${target}`);
        return listenHost;
      } else {
        return '';
      }
    } else {
      console.error(`Response: ${getResponse.body}`);
      console.error(`Response status: ${getResponse.status}`);
      fail(`Unable to open session for '${this.name}'`);
    }
  }

  private openSessionRequest(url: string, relayer: HoprdNode, receiver: HoprdNode, target: string): string {
        const payload = JSON.stringify({
            destination: receiver.peerId,
            target: { Plain: `${target}` },
            capabilities: ["Segmentation", "Retransmission"],
            path: { IntermediatePath: [relayer.peerId]}
          });
        //console.log(`[Setup] Opening new session: ${payload}`);
        const postResponse: RefinedResponse<"text"> = http.post(url, payload, this.httpParams);
        if (postResponse.status === 200) {
          const session = JSON.parse(postResponse.body);
          let listenHost;
          if (session.ip === '0.0.0.0') { // In Kubernetes
            listenHost=`${this.p2p}:${session.port}`;
          } else {
            listenHost = `${session.ip}:${session.port}`;
          }
          console.log(`[Setup] New session opened ${this.name} => ${relayer.name} => ${receiver.name} listening at ${listenHost} to target ${target}`);
          return listenHost;
        } else {
          console.error(`Open session response: ${postResponse.body}`);
          console.error(`Open session response status: ${postResponse.status}`);
          fail(`Unable to open session for '${this.name}'`);
        }
  }
}
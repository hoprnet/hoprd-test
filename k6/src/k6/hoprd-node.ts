import http, { RefinedParams, RefinedResponse, ResponseType } from "k6/http";
import { fail, sleep } from "k6";

// This class cannot implement async methods as it is used in the k6 script
export class HoprdNode {
  public name: string;
  public nodeName: string;
  public url: string;
  public p2p: string;
  public enabled: boolean;
  public isEntryNode: boolean;
  public isRelayerNode: boolean;
  public isExitNode: boolean;
  public peerAddress: string;
  public httpParams: RefinedParams<ResponseType>;

  constructor(data) {
    this.name = data.name;
    this.url = data.url + "/api/v4";
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
      (this.isEntryNode = data.isEntryNode),
      (this.isRelayerNode = data.isRelayerNode),
      (this.nodeName = data.instance),
      (this.p2p = data.p2p),
      (this.isExitNode = data.isExitNode);
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


  public openSession(relayerNode: HoprdNode, exitNode: HoprdNode, protocol: string, target: string, capabilities: string[], maxSurbUpstream: number, responseBuffer: number): string {
    if (__ENV.K6_SKIP_HOPRD_SESSIONS === 'true') {
      return target;
    } else {
      const url = `${this.url}/session/${protocol}`;
      let listenHost = this.getSessionRequest(url, protocol, target);
      if (listenHost == '') {
        listenHost = this.openSessionRequest(url, relayerNode, exitNode, target, capabilities, maxSurbUpstream, responseBuffer);
      }
      return listenHost;
    }
  }


  public closeSession(protocol: string, port: number) {
        let url = `${this.url}/session/${protocol}`;
        const getResponse: RefinedResponse<"text"> = http.get(url, this.httpParams);
        if (getResponse.status === 200) {
              const sessions: {target: string, protocol: string, ip: string, port: number}[] = JSON.parse(getResponse.body);
              const openedSession = sessions.filter((session) => session.target.endsWith(`:${port.toString()}`) && session.protocol == protocol);
              if (openedSession.length == 1) {
                //console.log(`[Teardown] Found opened session for target ${target} on protocol ${protocol}`);
                url = `${this.url}/session/${protocol}/${openedSession[0].ip}/${openedSession[0].port}`;
                //console.log(`[Teardown] Closing session at ${url} with ${JSON.stringify(this.httpParams)}`);
                const deleteResponse: RefinedResponse<"text"> = http.del(url, "{}", this.httpParams);
                if (deleteResponse.status === 204) {
                  console.log(`[Teardown] Session closed on protocol ${protocol} for node ${this.name} at ${url}`);
                } else {
                  console.error(`Close session response: ${deleteResponse.body}`);
                  console.error(`Close session response status: ${deleteResponse.status}`);
                  fail(`Unable to close session for '${this.name}'`);
                }
              } else {
                console.warn(`[Teardown] No opened session found for port ${port} on protocol ${protocol}`);
              }
        } else {
          console.error(`Response: ${getResponse.body}`);
          console.error(`Response status: ${getResponse.status}`);
          fail(`Unable to get sessions for '${this.name}'`);
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

  private openSessionRequest(url: string, relayer: HoprdNode, exitNode: HoprdNode, target: string, capabilities: string[], maxSurbUpstream: number, responseBuffer: number): string {
        const payload = JSON.stringify({
            destination: exitNode.peerAddress,
            target: { Plain: `${target}` },
            capabilities: capabilities,
            maxSurbUpstream: `${maxSurbUpstream} kb/s`,
            responseBuffer: `${responseBuffer} MB`,
            forwardPath: {
              IntermediatePath: [relayer.peerAddress]
            },
            returnPath: {
              IntermediatePath: [relayer.peerAddress]
            }
          });
        //console.log(`[Setup] Opening new session: ${payload}`);
        const postResponse: RefinedResponse<"text"> = http.post(url, payload, this.httpParams);
        if (postResponse.status === 200) {
          const session = JSON.parse(postResponse.body);
          let listenHost;
          if (session.ip === '0.0.0.0') { // Session created in Kubernetes infrastructure
            listenHost=`${this.p2p}:${session.port}`;
          } else if (session.ip.startsWith("172.")) { // Session created in Docker compose infrastructure
            listenHost=`${this.p2p}:${session.port}`;
          } else {
            listenHost = `${session.ip}:${session.port}`;
          }
          const waitTime = 15;
          console.log(`[Setup] New session opened ${this.name} => ${relayer.name} => ${exitNode.name} listening at ${listenHost} to target ${target} and waiting ${waitTime}s to be established`);
          sleep(waitTime); // wait for session to be established
          return listenHost;
        } else {
          console.error(`Open session response: ${postResponse.body}`);
          console.error(`Open session response status: ${postResponse.status}`);
          fail(`Unable to open session for '${this.name}'`);
        }
  }
}
import { Options } from 'k6/options'
import execution from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'
import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'
import { check, fail } from 'k6'
import ws from 'k6/ws';
// 1. Begin Init section
const nodes = __ENV.NODES || 'many2many'

// Load nodes
const nodesData = JSON.parse(open(`./nodes-${nodes}.json`))
const amountOfSenders = nodesData.nodes.filter((node: any) => node.enabled && node.isSender != undefined && node.isSender).length
const amountOfReceivers = nodesData.nodes.filter((node: any) => node.enabled && node.isReceiver != undefined && node.isReceiver).length

// Override API Token
if (__ENV.HOPRD_API_TOKEN) {
  nodesData.nodes.forEach((node: any) => {
    node.apiToken = __ENV.HOPRD_API_TOKEN
    if (!node.url.endsWith('api/v3')) {
      node.url += 'api/v3'
    }
  });
}

// Test Options https://docs.k6.io/docs/options
__ENV.WEBSOCKET_DISCONNECTED = 'false';
const workloadName = __ENV.WORKLOAD_NAME || 'sanity-check'
const optionsData = JSON.parse(open(`./workload-${workloadName}.json`))
let scenario: keyof typeof optionsData.scenarios;
let scenariosLength = 0;
for (scenario in optionsData.scenarios) {
  if (scenario !== "receive_messages") {
    if (scenario !== "incremental" && scenario !== "hysteresis" ) { // Incremental and Hysteresis scenarios should keep stage 0 target as is
      optionsData.scenarios[scenario].stages[0].target = amountOfSenders * (__ENV.SCENARIO_ITERATIONS || optionsData.scenarios[scenario].stages[0].target)
    }
    optionsData.scenarios[scenario].stages[1].target = amountOfSenders * (__ENV.SCENARIO_ITERATIONS || optionsData.scenarios[scenario].stages[1].target)
    if (__ENV.SCENARIO_DURATION) {
      if ( scenario === "hysteresis" ) { // Hysteresis scenario should divide the duration in half for stage 1 and 2
        let halfDuration = Math.floor(Number(__ENV.SCENARIO_DURATION) / 2);
        optionsData.scenarios[scenario].stages[1].duration = halfDuration + 'm'
        optionsData.scenarios[scenario].stages[2].duration = halfDuration + 'm'
      } else {
        optionsData.scenarios[scenario].stages[1].duration = __ENV.SCENARIO_DURATION + 'm'
      }
    }
    optionsData.scenarios[scenario].preAllocatedVUs = Math.max(1,Math.floor(amountOfSenders * (Number(__ENV.SCENARIO_ITERATIONS) || optionsData.scenarios[scenario].stages[1].target) / 2))
    scenariosLength++
  } else {
    optionsData.scenarios[scenario].vus = amountOfSenders * 5 // Increasing the probability of opening a websocket connection per sender
    if (__ENV.SCENARIO_DURATION) {
      let durationInSeconds = Number(__ENV.SCENARIO_DURATION) * 60 + 70;
      optionsData.scenarios[scenario].maxDuration = durationInSeconds + 's';
    }
  }
}
//console.log("Test execution options: ");
//console.log(JSON.stringify(optionsData))
export const options: Partial<Options> = optionsData

// Define metrics
let messageRequestsSucceed = new Counter('hopr_message_requests_succeed') // Counts the number of messages requests successfully sent  
let messageRequestsFailed = new Counter('hopr_message_requests_failed') // Counts the number of failed message requests received
let sentMessagesSucceed = new Counter('hopr_sent_messages_succeed') // Counts the number of X hop messages successfully transmitted  
let messagesRelayedSucceed = new Counter('hopr_messages_relayed_succeed') // Counts the number of messages successfully relayed
let messageLatency = new Trend('hopr_message_latency');

// 1. End Init section

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  const senders: HoprdNode[] = []
  const receivers: HoprdNode[] = []
  const relayers: HoprdNode[] = []
  nodesData.nodes
  .filter((node: any) => node.enabled)
  .forEach((node: any) => {
    let hoprdNode: HoprdNode = new HoprdNode(node)
    if (hoprdNode.isSender) {
      console.log(`Setting up ${hoprdNode.name} as sender`)
      senders.push(hoprdNode)
    }
    if (hoprdNode.isReceiver) {
      console.log(`Setting up ${hoprdNode.name} as receiver`)
      receivers.push(hoprdNode)
    }
    if (hoprdNode.isRelayer) {
      console.log(`Setting up ${hoprdNode.name} as relayer`)
      relayers.push(hoprdNode)
    }
    
  })
  // console.log(`Senders: ${JSON.stringify(senders)}`);
  // console.log(`Relayers: ${JSON.stringify(relayers)}`);
  return { senders, relayers, receivers }
}

// This function is executed for each iteration
// default function imports the return data from the setup function https://docs.k6.io/docs/test-life-cycle
export function receiveMessages(dataPool: { senders: HoprdNode[], relayers: HoprdNode[], receivers: HoprdNode[] }) {
  const nodeIndex = Math.ceil((execution.vu.idInInstance ) % amountOfReceivers)
  //console.log(`[idInstance ${execution.vu.idInInstance}] [nodeIndex: ${nodeIndex}] < ${amountOfReceivers}`)
  if (execution.vu.idInInstance <= amountOfReceivers) {
    const receiverHoprdNode = dataPool.receivers[nodeIndex];  
    let wsUrl = receiverHoprdNode.url.replace('http', 'ws');
    wsUrl = `${wsUrl}/messages/websocket`
    console.log(`Connecting to ${receiverHoprdNode.name} via websocket`)
    const websocketResponse = ws.connect(wsUrl, receiverHoprdNode.httpParams, function (socket) {
      socket.on('open', () => console.log(`Connected via websocket to node ${receiverHoprdNode.name}`));
      socket.on('message', (data) => { 
        let message = JSON.parse(data)
        let messageType = message.type;
        if (messageType === 'message') {
          let startTime = message.body.split(' ')[0];
          let tags = JSON.parse(message.body.split(' ')[1]);
          let duration = new Date().getTime() - startTime;
          messageLatency.add(duration, tags);
          console.log(`Message received on ${receiverHoprdNode.name} relayed from ${tags.path} with latency ${duration} ms`)
          sentMessagesSucceed.add(1, tags);
        } else if (messageType === 'message-ack') {
          messagesRelayedSucceed.add(1, {origin: receiverHoprdNode.name});
          //console.log(`Message ack received on ${senderHoprdNode.name}`)
        } else {
          console.log(`Unknown message type ${messageType} received on ${receiverHoprdNode.name}`)
        }
      });
      socket.on('error', (error) => {
        __ENV.WEBSOCKET_DISCONNECTED = 'true';
        console.error(`Node ${receiverHoprdNode.name} replied with a websocket error:`, error);
      });
      socket.on('close', (errorCode: any) => {
        __ENV.WEBSOCKET_DISCONNECTED = 'true';
        console.log(`Disconnected via websocket from node ${receiverHoprdNode.name} due to error code ${errorCode} at ${new Date().toISOString()}`);
      });
    });
    check(websocketResponse, { 'status is 101': (r) => r && r.status === 101 });
  } else {
    //console.log(`No sender nodes available for this VU '${execution.vu.idInInstance}'`)
  }
}

// This function is executed for each iteration
// default function imports the return data from the setup function https://docs.k6.io/docs/test-life-cycle
export function multipleHopMessage(dataPool: { senders: HoprdNode[], relayers: HoprdNode[], receivers: HoprdNode[] }) {
  const hops = Number(__ENV.HOPS) || 1
  const nodeIndex = Math.ceil(execution.vu.idInInstance % (amountOfSenders * scenariosLength))
  //console.log(`idInstance: ${execution.vu.idInInstance} having index : ${nodeIndex} from scenario[${execution.scenario.name}]`)
  const sender = dataPool.senders[nodeIndex]
  if (__ENV.WEBSOCKET_DISCONNECTED === 'true') {
      fail(`Node ${sender.name} disconnected from websocket`)
  }

  // Set the receiver node
  const receivers = dataPool.receivers.filter((receiver: HoprdNode) => receiver.name != sender.name)
  let receiver;
  if (receivers.length === 0) {
    fail(`No receiver nodes available for this VU '${execution.vu.idInInstance}'`)
  } else {
    receiver = receivers[Math.floor(Math.random() * receivers.length )];
  }

  // Set the Path
  let nodesPath: HoprdNode[] = [];
  const relayers = dataPool.relayers.filter((relayer: HoprdNode) => relayer.name != sender.name && relayer.name != receiver.name)
  while (nodesPath.length < hops) {
    const relayer = relayers[Math.floor(Math.random() * relayers.length)]
    if (!nodesPath.some(includedNode => includedNode.name === relayer.name)) {
      nodesPath.push(relayer)
    }
  }
  let pathNames = nodesPath.map((node: HoprdNode) => node.name).join(' -> ');
  let path = nodesPath.map((node: HoprdNode) => node.peerId);

  //console.log(`[VU:${execution.vu.idInInstance}] - Sending ${hops} hops message [${sender.name}] (source) -> [${pathNames}] (relayers) -> [${receiver.name}] (target)`)
  let tags = {name: sender.name, hops: hops, path: pathNames}
  let startTime = new Date().getTime();
  let body = `${startTime} ${JSON.stringify(tags)}`;
  sendMessage(sender.url, sender.httpParams, JSON.stringify({ tag: execution.vu.idInInstance + 1024, body, path, peerId: receiver.peerId, hops }), tags)
}

export function teardown(dataPool: { senders: HoprdNode[], nodes: HoprdNode[] }) {
  console.log('teardown will still be called even when calling exec.test.abort()')
}

export function sendMessage(apiUrl, httpParams, requestPayload, tags) {
  let startTime = new Date().getTime();

  const messageRequestResponse = http.post(`${apiUrl}/messages`, requestPayload, httpParams, ) // Send the 1 hop message
  if (messageRequestResponse.status === 202) {
    messageRequestsSucceed.add(1, tags);
  } else {
    console.error(`Failed to send message request. Details: ${JSON.stringify(messageRequestResponse)}`)
    messageRequestsFailed.add(1, tags);
    return false
  }
  return true
}

// This class cannot implement async methods
export class HoprdNode {

  public name: string
  public url: string
  public isSender: boolean
  public isRelayer: boolean
  public isReceiver: boolean
  public peerAddress: string
  public httpParams: RefinedParams<ResponseType>
  public peerId: string

  constructor(data) {
    this.name = data.name
    this.url = data.url;
    this.httpParams = {
      headers: {
        'x-auth-token': data.apiToken,
        'Content-Type': 'application/json'
      },
      tags: {
        node_name: data.name,
        name: data.name
      }
    },
      this.isSender = data.isSender,
      this.isRelayer = data.isRelayer,
      this.isReceiver = data.isReceiver
      this.getAddress(data)
  }

  private getAddress(data) {
    const httpParams = {
      headers: {
        'x-auth-token': data.apiToken,
        'Content-Type': 'application/json'
      },
      tags: {
        name: 'init_test',
      }
    }
    const response: RefinedResponse<'text'> = http.get(`${this.url}/account/addresses`, httpParams)
    if (response.status === 200) {
      const addresses = JSON.parse(response.body)
      this.peerAddress = addresses.native
      this.peerId = addresses.hopr
    } else {
      fail(`Unable to get node addresses for '${this.name}'`)
    }
  }

}
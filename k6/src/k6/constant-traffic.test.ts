import { Options } from 'k6/options'
import execution from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'
import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'
import { fail, sleep } from 'k6'
import ws from 'k6/ws';
// 1. Begin Init section
const environmentName = __ENV.ENVIRONMENT_NAME || 'local'
const PACKET_PAYLOAD_SIZE = 480; // It supports 500 bytes of payload but we are using 480 bytes to avoid errors
const MAX_MESSAGE_RESPONSE_WAIT_TIME = 30000; // 30 seconds

// Load nodes
const nodesData = JSON.parse(open(`./nodes-${environmentName}.json`))
const amountOfSenders = nodesData.nodes.filter((node: any) => node.isSender != undefined && node.isSender).length

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
const workloadName = __ENV.WORKLOAD_NAME || 'sanity-check'
const optionsData = JSON.parse(open(`./workload-${workloadName}.json`))
let scenario: keyof typeof optionsData.scenarios;
let scenariosLength = 0;
for (scenario in optionsData.scenarios) {
  optionsData.scenarios[scenario].stages[0].target = amountOfSenders * (__ENV.SCENARIO_ITERATIONS || optionsData.scenarios[scenario].stages[0].target)
  optionsData.scenarios[scenario].stages[1].target = amountOfSenders * (__ENV.SCENARIO_ITERATIONS || optionsData.scenarios[scenario].stages[1].target)
  if (__ENV.SCENARIO_DURATION) {
    optionsData.scenarios[scenario].stages[1].duration = __ENV.SCENARIO_DURATION
  }
  optionsData.scenarios[scenario].preAllocatedVUs = Math.floor(amountOfSenders * (Number(__ENV.SCENARIO_ITERATIONS) || optionsData.scenarios[scenario].stages[1].target) / 2)
  scenariosLength++
}
//console.log("Test execution options: ");
//console.log(JSON.stringify(optionsData))
export const options: Partial<Options> = optionsData

// Define metrics
let messageRequestsSucceed = new Counter('hopr_message_requests_succeed') // Counts the number of messages requests successfully sent  
let messageRequestsFailed = new Counter('hopr_message_requests_failed') // Counts the number of failed message requests received
let sentMessagesSucceed = new Counter('hopr_sent_messages_succeed') // Counts the number of X hop messages successfully transmitted  
let sentMessagesFailed = new Counter('hopr_sent_messages_failed') // Counts the number of X hop messages not relayed
let messageLatency = new Trend('hopr_message_latency');

// 1. End Init section

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  const senders: HoprdNode[] = []
  const nodes: HoprdNode[] = []
  nodesData.nodes.forEach((node: any) => {
    let hoprdNode: HoprdNode = new HoprdNode(node)
    if (hoprdNode.isSender) {
      senders.push(hoprdNode)
    }
    nodes.push(hoprdNode)
  })
  return { senders, nodes }
}

// This function is executed for each iteration
// default function imports the return data from the setup function https://docs.k6.io/docs/test-life-cycle
export function multipleHopMessage(dataPool: { senders: HoprdNode[], nodes: HoprdNode[] }) {
  const nodeIndex = Math.ceil(execution.vu.idInInstance % (amountOfSenders * scenariosLength))
  // console.log(`idInstance: ${execution.vu.idInInstance} having index : ${nodeIndex} from scenario[${execution.scenario.name}]`)
  const senderHoprdNode = dataPool.senders[nodeIndex]
  const hops = Number(__ENV.HOPS) || 1
  let nodesPath: HoprdNode[] = [];
  for (let i = 0; i < hops; i++) {
    let recipientLength = Math.floor(Math.random() * (dataPool.nodes.length - 1))
    let recipientHoprdNode = dataPool.nodes
      .filter((node: HoprdNode) => node.name != senderHoprdNode.name)
    [recipientLength]
    if (nodesPath.some(includedNode => includedNode.name === recipientHoprdNode.name)) {
      i--;
    } else {
      nodesPath.push(recipientHoprdNode)
    }
  }
  let pathNames = nodesPath.map((node: HoprdNode) => node.name).join(' -> ');
  let pathPeerIds = nodesPath.map((node: HoprdNode) => node.peerId);
  let body = new Array(PACKET_PAYLOAD_SIZE).join().replace(/(.|$)/g, function(){return ((Math.random()*36)|0).toString(36)[Math.random()<.5?"toString":"toUpperCase"]();});

  console.log(`[VU:${execution.vu.idInInstance}] - Sending ${hops} hops message ${senderHoprdNode.name} (source) -> [${pathNames}] -> ${senderHoprdNode.name} (destination)`)
  let tags = {name: senderHoprdNode.name, hops: hops, path: pathNames}
  sendMessage(senderHoprdNode.url, senderHoprdNode.httpParams, JSON.stringify({ tag: execution.vu.idInInstance, body, path: pathPeerIds, peerId: senderHoprdNode.peerId, hops }), tags)
}

export function teardown(dataPool: { senders: HoprdNode[], nodes: HoprdNode[] }) {
  console.log('teardown will still be called even when calling exec.test.abort()')
}

export function sendMessage(apiUrl, httpParams, requestPayload, tags) {
  let startTime = new Date().getTime();

  const messageRequestResponse = http.post(`${apiUrl}/messages`, requestPayload, httpParams, ) // Send the 1 hop message
  if (messageRequestResponse.status === 202) {
    messageRequestsSucceed.add(1);
    let messageReceived = false;
    while (!messageReceived && ((new Date().getTime()) - startTime) < MAX_MESSAGE_RESPONSE_WAIT_TIME) {
      sleep(0.5)
      const messagePeekResponse = http.post(`${apiUrl}/messages/pop`, JSON.stringify({tag: execution.vu.idInInstance}), httpParams) 
      if (messagePeekResponse.status === 200 && messagePeekResponse.body !== null) {
        const receivedAt = JSON.parse(messagePeekResponse.body as string).receivedAt
        messageLatency.add(receivedAt - startTime, tags);
        sentMessagesSucceed.add(1, tags);
        messageReceived = true;
      }
    }
    if (!messageReceived) {
      console.error(`Message not received after ${MAX_MESSAGE_RESPONSE_WAIT_TIME} ms. Details: "`, tags)
      sentMessagesFailed.add(1, tags);
      return false
    }
  } else {
    console.error(`Failed to send message request. Details: ${JSON.stringify(messageRequestResponse)}`)
    messageRequestsFailed.add(1, tags);
    return false
  }
  return true
}

export class HoprdNode {

  public name: string
  public url: string
  public isSender: string
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
import { Options } from 'k6/options'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import execution from 'k6/execution'
import { Counter } from 'k6/metrics'
import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'
import { check, fail } from 'k6'

// 1. Begin Init section
const environmentName = __ENV.ENVIRONMENT_NAME || 'local'

// Load nodes
const nodesData = JSON.parse(open(`./nodes-${environmentName}.json`))
const amountOfSenders = nodesData.nodes.filter((node: any) => node.isSender != undefined && node.isSender ).length

// Override API Token
if (__ENV.HOPRD_API_TOKEN) {
  nodesData.nodes.forEach((node: any) => {
    node.apiToken = __ENV.HOPRD_API_TOKEN
    if (! node.url.endsWith('api/v3')) {
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
  optionsData.scenarios[scenario].preAllocatedVUs = amountOfSenders * (Number(__ENV.NODE_THREADS) || 1 )
  scenariosLength++
}
//console.log(JSON.stringify(optionsData))
export const options: Partial<Options> = optionsData


let numberOfMessagesSuccessfullySent = new Counter('NumberOfMessagesSuccessfullySent')
let numberOfSentMessagesFailed = new Counter('NumberOfSentMessagesFailed')

// 1. End Init section

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  const senders: HoprdNode[] = []
  const nodes: HoprdNode[] = []
  nodesData.nodes.forEach((node: any) => {
      let hoprdNode: HoprdNode = new HoprdNode(node)
      if (hoprdNode.isSender){
        senders.push(hoprdNode)
      }
      nodes.push(hoprdNode)
  })
  return { senders, nodes }
}

// This function is executed for each iteration
// default function imports the return data from the setup function https://docs.k6.io/docs/test-life-cycle
export function multipleHopMessage (dataPool: { senders: HoprdNode[], nodes: HoprdNode[]}) {
  const nodeIndex = Math.ceil(execution.vu.idInInstance % (amountOfSenders * scenariosLength))
  // console.log(`idInstance: ${execution.vu.idInInstance} having index : ${nodeIndex} from scenario[${execution.scenario.name}]`)
  const senderHoprdNode = dataPool.senders[nodeIndex]
  const hops = Number(__ENV.HOPS) || 1
  let recipientLength = Math.floor(Math.random() * (dataPool.nodes.length -1))
  let recipientHoprdNode = dataPool.nodes
    .filter((node: HoprdNode) => node.name != senderHoprdNode.name)
    [recipientLength]
  console.log(`[VU:${execution.vu.idInInstance}] - Sending ${hops} hops message from ${senderHoprdNode.name} to ${recipientHoprdNode.name}`)  
  sendMessage(senderHoprdNode.url, senderHoprdNode.httpParams,JSON.stringify({ tag: nodeIndex, body: randomString(15), peerId: recipientHoprdNode.peerId, hops }))
}

export function teardown() {
  console.log('teardown will still be called even when calling exec.test.abort()')
}

export async function sendMessage(url, httpParams, requestPayload) {
    // console.log(`Sending message ${JSON.stringify(messageRequest)}`)
    const messageResponse = http.post(
      `${url}/messages`, requestPayload,     
      httpParams
    )

    if (check(messageResponse, { 'Message sent': () => messageResponse.status === 202 })) {
      numberOfMessagesSuccessfullySent.add(1)
      return true
    } else {
      console.error(`Failed to send message. Details: ${JSON.stringify(messageResponse)}`)
      numberOfSentMessagesFailed.add(1,{ request: requestPayload, response: JSON.stringify(messageResponse) });
      return false
    }

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

  private getAddress (data) {
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
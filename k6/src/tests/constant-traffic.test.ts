import { Options } from 'k6/options'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import execution from 'k6/execution'
import { Counter } from 'k6/metrics'
import { HoprdNode } from '../types'
import { MesssagesApi } from '../api'

// 1. Begin Init section
const environmentName = __ENV.ENVIRONMENT_NAME || 'local'

// Load nodes
const nodesData = JSON.parse(open(`./nodes-${environmentName}.json`))
const sendersLength = nodesData.nodes.filter((node: any) => node.isSender != undefined && node.isSender ).length

// Override API Token
if (__ENV.HOPRD_API_TOKEN) {
  nodesData.nodes.forEach((node: any) => {
    node.apiToken = __ENV.HOPRD_API_TOKEN
  });
}

// Test Options https://docs.k6.io/docs/options
const workloadName = __ENV.WORKLOAD_NAME || 'simple'
const optionsData = JSON.parse(open(`./workload-${workloadName}.json`))
let scenario: keyof typeof optionsData.scenarios;
let scenariosLength = 0;
for (scenario in optionsData.scenarios) {
  optionsData.scenarios[scenario].stages[0].target = sendersLength * optionsData.scenarios[scenario].stages[0].target
  optionsData.scenarios[scenario].stages[1].target = sendersLength * optionsData.scenarios[scenario].stages[1].target
  optionsData.scenarios[scenario].preAllocatedVUs = sendersLength
  scenariosLength++
}
//console.log(JSON.stringify(optionsData))
export let options: Partial<Options> = optionsData


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
  const getPeerAddressByNodeName = (nodeName: string): string => { return nodes.find((node: HoprdNode) => node.name == nodeName)?.peerAddress || ''}
  nodes.forEach((node: HoprdNode) => {
    node.routes.forEach((route: {name: string}) => {
      const routePeerAddress = getPeerAddressByNodeName(route.name)
      //let incommingChannels: string[] = node.channels.incoming.map((channel) => channel.peerAddress)
      //console.log(`Comparing peerId[${peerAddress}] with current incommingChannels[${incommingChannels}]`)
      const channel = node.channels.incoming.find((channel) => channel.status == 'Open' && channel.peerAddress == routePeerAddress )
      if (! channel) {
        console.log(`[Setup] Openning incomming channel from ${node.name} [${node.peerAddress}] to ${route.name} [${routePeerAddress}]`)
        node.openChannel(routePeerAddress)
      }
    })
  })

  // anything returned here can be imported into the default function https://docs.k6.io/docs/test-life-cycle
  return { senders, nodes }
}

// This function is executed for each iteration
// default function imports the return data from the setup function https://docs.k6.io/docs/test-life-cycle
export function multipleHopMessage (dataPool: { senders: HoprdNode[], nodes: HoprdNode[]}) {
  const nodeIndex = Math.ceil(execution.vu.idInInstance / scenariosLength) - 1
  //console.log(`idInstance: ${execution.vu.idInInstance} having index : ${nodeIndex} from scenario[${execution.scenario.name}]`)
  const senderHoprdNode = dataPool.senders[nodeIndex]
  const hops = Number(__ENV.HOPS) || 1
  let recipientLength = Math.floor(Math.random() * (dataPool.nodes.length -1))
  let recipientHoprdNode = dataPool.nodes
    .filter((node: HoprdNode) => node.name != senderHoprdNode.name)
    [recipientLength]
  console.log(`[VU:${nodeIndex}][Scenario:${execution.scenario.name}] - Sending ${hops} hops message from ${senderHoprdNode.name} [${senderHoprdNode.peerId}] to ${recipientHoprdNode.name} [${recipientHoprdNode.peerId}]`)  
  const messageApi = new MesssagesApi(senderHoprdNode.url, senderHoprdNode.httpParams)
  messageApi.sendMessage(JSON.stringify({ tag: nodeIndex, body: randomString(15), peerId: recipientHoprdNode.peerId, hops }), numberOfMessagesSuccessfullySent, numberOfSentMessagesFailed)
}

export function teardown() {
  console.log('teardown will still be called even when calling exec.test.abort()')
}

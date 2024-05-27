import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import ws from 'k6/ws';
import { check, fail, sleep } from 'k6';

import { Options } from 'k6/options'
import execution from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'
import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'

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

const applicationTag = randomIntBetween(10000, 60000);


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

export default function () {
    // const url = `wss://test-api.k6.io/ws/crocochat/${chatRoomName}/`;
    // const params = { tags: { my_tag: 'my ws session' } };

    // const res = ws.connect(url, params, function (socket) {
    //     socket.on('open', function open() {
    //         console.log(`VU ${__VU}: connected`);

    //         socket.send(JSON.stringify({ event: 'SET_NAME', new_name: `Croc ${__VU}` }));

    //         socket.setInterval(function timeout() {
    //             socket.send(JSON.stringify({ event: 'SAY', message: `I'm saying ${randomString(5)}` }));
    //         }, randomIntBetween(2000, 8000)); // say something every 2-8seconds
    //     });

    //     socket.on('ping', function () {
    //         console.log('PING!');
    //     });

    //     socket.on('pong', function () {
    //         console.log('PONG!');
    //     });


    //     socket.on('close', function () {
    //         console.log(`VU ${__VU}: disconnected`);
    //     });

    //     socket.on('message', function (message) {
    //         const msg = JSON.parse(message);
    //         if (msg.event === 'CHAT_MSG') {
    //             console.log(`VU ${__VU} received: ${msg.user} says: ${msg.message}`);
    //         } else if (msg.event === 'ERROR') {
    //             console.error(`VU ${__VU} received:: ${msg.message}`);
    //         } else {
    //             console.log(`VU ${__VU} received unhandled message: ${msg.message}`);
    //         }
    //     });


    //     socket.setTimeout(function () {
    //         console.log(`VU ${__VU}: ${applicationTag}ms passed, leaving the chat`);
    //         socket.send(JSON.stringify({ event: 'LEAVE' }));
    //     }, applicationTag);


    //     socket.setTimeout(function () {
    //         console.log(`Closing the socket forcefully 3s after graceful LEAVE`);
    //         socket.close();
    //     }, applicationTag + 3000);
    // });

    // check(res, { 'Connected successfully': (r) => r && r.status === 101 });
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
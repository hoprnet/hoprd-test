import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { check, fail } from "k6";
import ws from "k6/ws";
import { HoprdNode } from "./hoprd-node";
import { getDestination, Utils } from "./utils";

// Read nodes
const topologyName = __ENV.TOPOLOGY_NAME || "many2many";
const nodesData = JSON.parse(open(`./nodes-${topologyName}.json`)).nodes
    .map((node) => { 
      node.apiToken = __ENV.HOPRD_API_TOKEN
      if (!node.url.endsWith("api/v3")) {
        node.url += "api/v3";
      }
      return node;
  });
let sendersData: any[] = [];
let receiversData: any[] = [];
let relayersData: any[] = [];
nodesData.filter((node: any) => node.enabled)
  .forEach((node: any) => {
    if (node.isSender) {
      sendersData.push(node);
    }
    if (node.isRelayer) {
      relayersData.push(node);
    }
    if (node.isReceiver) {
      receiversData.push(node);
    }
  });
let dataPool = sendersData
  .flatMap(sender => {
    return receiversData.flatMap(receiver => {
      return relayersData.map( relayer => { return { sender, relayer, receiver}; });
    })
  })
  .filter((route) => route.sender.name !== route.receiver.name && route.sender.name !== route.relayer.name && route.relayer.name !== route.receiver.name);
  
// Read workload options
__ENV.WEBSOCKET_DISCONNECTED = "false";
const workloadName = __ENV.WORKLOAD_NAME || "sanity-check";
let messageDelay: number = 1000;
if (__ENV.REQUESTS_PER_SECOND_PER_VU) {
  messageDelay = 1000 / parseInt(__ENV.REQUESTS_PER_SECOND_PER_VU);
}
let duration: number = 1;
if (__ENV.DURATION) {
  duration = parseInt(__ENV.DURATION);
}
let vuPerRoute = 1;
if (__ENV.VU_PER_ROUTE) {
  vuPerRoute = parseInt(__ENV.VU_PER_ROUTE);
}
let hops = 1;
if (__ENV.HOPS) {
  hops = parseInt(__ENV.HOPS);
}

const workloadOptions = JSON.parse(open(`./workload-${workloadName}.json`));
Object.keys(workloadOptions.scenarios).forEach((scenario) => {
  if (workloadOptions.scenarios[scenario].executor === "per-vu-iterations") {
    workloadOptions.scenarios[scenario].vus = dataPool.length * vuPerRoute;
    workloadOptions.scenarios[scenario].maxDuration = `${duration}m`;
  }
  if (workloadOptions.scenarios[scenario].executor === "ramping-vus") {
    workloadOptions.scenarios[scenario].stages[0].target = dataPool.length * vuPerRoute;
    if (scenario === "hysteresis") {
      duration = duration / 2;
      workloadOptions.scenarios[scenario].stages[1].duration = `${duration}m`;
    }
    workloadOptions.scenarios[scenario].stages[0].duration = `${duration}m`;
  }
});

// Default metric labels:

if (__VU === 1) { // Only print once to avoid spamming the console
  //dataPool.forEach((route: any) => console.log(`[Setup] DataPool sender ${route.sender.name} -> ${route.relayer.name} -> ${route.receiver.name}`));
  console.log(`[Setup] Workload: ${workloadName}`);
  console.log(`[Setup] Topology: ${topologyName}`);
  console.log(`[Setup] Test duration set to ${duration}m`);
  console.log(`[Setup] Hops: ${__ENV.HOPS || 1}`); 
  console.log(`[Setup] Senders: ${sendersData.length}`);
  console.log(`[Setup] Relayers: ${relayersData.length}`);
  console.log(`[Setup] Receivers: ${receiversData.length}`);
  console.log(`[Setup] Request per second per VU: ${__ENV.REQUESTS_PER_SECOND_PER_VU || 1}`);
  console.log(`[Setup] VU per node: ${__ENV.VU_PER_ROUTE || 1}`);
  console.log(`[Setup] Routes: ${dataPool.length}`);
  console.log(`[Setup] Message delay set to ${Math.trunc(messageDelay)} ms`);
  // console.log("Test execution options: ");
  // console.log(JSON.stringify(workloadOptions))
}

// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = workloadOptions;

// Define metrics
const defaultMetricLabels = { workload: workloadName, topology: topologyName, hops: hops.toString() };
const messageRequests = new Counter("hopr_message_requests"); // Counts the number of messages requests successfully sent
const sentMessagesSucceed = new Counter("hopr_sent_messages_succeed"); // Counts the number of X hop messages successfully transmitted
const sentMessagesFailed = new Counter("hopr_sent_messages_failed"); // Counts the number of X hop messages failed transmittion
const messageLatency = new Trend("hopr_message_latency");
const dataSent = new Counter("hopr_data_sent");
const dataReceived = new Counter("hopr_data_received");
const workloadType = new Gauge("hopr_workload_type");
const topologyType = new Gauge("hopr_topology_type");

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  switch (workloadName) {
    case 'sanity-check':
      workloadType.add(1);
      break;
    case 'constant':
      workloadType.add(2);
      break;
    case 'incremental':
      workloadType.add(3);
      break;
    case 'hysteresis':
      workloadType.add(4);
      break;
    default:
      console.log('Unknown workload type');
      break;
  }
  switch (topologyName) {
    case 'local':
      topologyType.add(0);
      break;
    case 'many2many':
      topologyType.add(1);
      break;
    case 'sender':
      topologyType.add(2);
      break;
    case 'receiver':
      topologyType.add(3);
      break;
    case 'relayer':
      topologyType.add(4);
      break;
    default:
      console.log('Unknown topology type');
      break;
  }
  return dataPool.map((route) => {
    return { 
      sender: new HoprdNode(route.sender),
      relayer: new HoprdNode(route.relayer),
      receiver: new HoprdNode(route.receiver) 
      };
  });
}

// Scenario to send messages
export function sendMessages(dataPool: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {

  const vu = Math.ceil((__VU - 1) % dataPool.length);
  const sender = dataPool[vu].sender;
  const relayer = dataPool[vu].relayer;
  const receiver = dataPool[vu].receiver;
  let websocketOpened = false;
  //console.log(`VU[${senderNodeIndex}] on scenario[${execution.scenario.name}]`)


  let url = sender.url.replace("http", "ws") + '/session/websocket?';
  url += 'capabilities=Segmentation&capabilities=Retransmission&';
  url += `target=${getDestination()}%3A80&`;
  url += `hops=${hops}&`;
  url += `path=${relayer.peerId}&`;
  url += `destination=${receiver.peerId}&`;
  url += 'protocol=tcp'; 

  //url = 'ws://localhost:8888';
  //url = 'ws://k6-echo.k6-operator-system.svc:8888';
  //console.log(`Url: ${url}`);

  //Open websocket connection to receiver node
  console.log(`[Sender][VU ${vu + 1}] Connecting sender ${sender.name} via websocket to ${receiver.name}`);
  const websocketResponse = ws.connect(url,sender.httpParams,function (socket) {
      socket.on("open", () => {
        websocketOpened=true;
        console.log(`[Sender][VU ${vu + 1}] Connected via websocket to sender node ${sender.name}`);
        socket.setInterval(function timeout() {
          if (__ENV.WEBSOCKET_DISCONNECTED === "true") {
            console.log(`[Sender][VU:${vu + 1}] Websocket disconnected. Stopping the interval`);
            socket.close();
            return;
          }
          const messagePayload: ArrayBuffer = Utils.buildMessagePayload();
          //console.log(`[Sender][VU:${senderNodeIndex + 1}] Sending ${hops} hops message from [${sender.name}] to [${receiver.name}]`);
          socket.sendBinary(messagePayload);
          dataSent.add(messagePayload.byteLength, { ...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name });
          messageRequests.add(1, { ...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        }, messageDelay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        try {
          const startTime = Utils.unpackMessagePayload(new Uint8Array(data));
          let duration = new Date().getTime() - parseInt(startTime);
          messageLatency.add(duration, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          console.log(`[Sender] Message received on ${sender.name} relayed from ${relayer.name} using exit node ${receiver.name} with latency ${duration} ms`);
          sentMessagesSucceed.add(1, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          dataReceived.add(data.byteLength, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        } catch (error) {
          console.error(`[Sender] Message received on ${sender.name} with incomplete data`);
          sentMessagesFailed.add(1, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          fail(`[Sender] Message received on ${sender.name} with incomplete data`);
        }
      });

      socket.on("error", (error) => {
        __ENV.WEBSOCKET_DISCONNECTED = "true";
        console.error(`[Sender] Node ${sender.name} replied with a websocket error:`, error);
        fail(`[Sender] Node ${sender.name} replied with a websocket error: ${error}`);
      });
      socket.on("close", (errorCode: any) => {
        __ENV.WEBSOCKET_DISCONNECTED = "true";
        console.log(`[Sender] Disconnected via websocket from node ${sender.name} due to error code ${errorCode} at ${new Date().toISOString()}`,
        );
      });
    },
  );
  check(websocketResponse, { "status is 101": (r) => r && r.status === 101 });
  if (!websocketOpened) {
    fail(`Failed to open a websocket on ${sender.name} to ${receiver.name} trying again`);
  }
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(dataPool: [{ sender: HoprdNode, receiver: HoprdNode }]) {
  console.log("[Teardown] Load test finished",);
}

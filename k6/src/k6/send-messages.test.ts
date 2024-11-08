import { Options } from "k6/options";
import execution from "k6/execution";
import { Counter, Trend } from "k6/metrics";
import { check, fail } from "k6";
import ws from "k6/ws";
import { HoprdNode } from "./hoprd-node";
import { Utils } from "./utils";

// Read nodes
const nodes = __ENV.NODES || "many2many";
const nodesData = JSON.parse(open(`./nodes-${nodes}.json`)).nodes
    .map((node) => { 
      node.apiToken = __ENV.HOPRD_API_TOKEN
      if (!node.url.endsWith("api/v3")) {
        node.url += "api/v3";
      }
      return node;
  });
let sendersData: any[] = [];
let receiversData: any[] = [];
nodesData.filter((node: any) => node.enabled)
  .forEach((node: any) => {
    if (node.isSender) {
      sendersData.push(node);
    }
    if (node.isReceiver) {
      receiversData.push(node);
    }
  });
let dataPool = sendersData.flatMap(sender => receiversData.map(receiver => { return { sender, receiver};})).filter((route) => route.sender.name !== route.receiver.name);

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

console.log(`[Setup] Initial VU ${dataPool.length}`);
console.log(`[Setup] Message delay set to ${Math.trunc(messageDelay)} ms`);
console.log(`[Setup] Test duration set to ${duration}m`);
//console.log("Test execution options: ");
//console.log(JSON.stringify(workloadOptions))


// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = workloadOptions;

// Define metrics
let messageRequests = new Counter("hopr_message_requests"); // Counts the number of messages requests successfully sent
let sentMessagesSucceed = new Counter("hopr_sent_messages_succeed"); // Counts the number of X hop messages successfully transmitted
let sentMessagesFailed = new Counter("hopr_sent_messages_failed"); // Counts the number of X hop messages failed transmittion
let messageLatency = new Trend("hopr_message_latency");
let dataSent = new Counter("hopr_data_sent");
let dataReceived = new Counter("hopr_data_received");

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  dataPool.map((route) => {
  return { 
    sender: new HoprdNode(route.sender), 
    receiver: new HoprdNode(route.receiver) 
    };
  })
  return dataPool;
}

// Scenario to send messages
export function sendMessages(dataPool: [{ sender: HoprdNode, receiver: HoprdNode }]) {

  const hops = Number(__ENV.HOPS) || 1;
  const vu = Math.ceil((__VU - 1) % dataPool.length);
  const sender = dataPool[vu].sender;
  const receiver = dataPool[vu].receiver;
  let websocketOpened = false;
  //console.log(`VU[${senderNodeIndex}] on scenario[${execution.scenario.name}]`)


  let url = sender.url.replace("http", "ws") + '/session/websocket?';
  url += 'capabilities=Segmentation&capabilities=Retransmission&';
  url += 'target=k6-echo.k6-operator-system.staging.hoprnet.link%3A80&';
  url += `hops=${hops}&`;
  url += `destination=${receiver.peerId}&`;
  url += 'protocol=tcp'; 

  //url = 'ws://localhost:8888';
  url = 'ws://k6-echo.k6-operator-system.svc:8888';
  //console.log(`Connecting to ${url}`);

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
          const messagePayload: ArrayBuffer = Utils.buildMessagePayload(sender.name, receiver.name);
          //console.log(`[Sender][VU:${senderNodeIndex + 1}] Sending ${hops} hops message from [${sender.name}] to [${receiver.name}]`);
          socket.sendBinary(messagePayload);
          dataSent.add(messagePayload.byteLength, { sender: sender.name, receiver: receiver.name });
          messageRequests.add(1, { sender: sender.name, receiver: receiver.name });
        }, messageDelay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        const { sender, receiver, startTime } = Utils.unpackMessagePayload(new Uint8Array(data));
        let duration = new Date().getTime() - parseInt(startTime);
        if (sender !== "unknown") {
          messageLatency.add(duration, {sender, receiver});
          console.log(`[Sender] Message received on ${receiver} sent from ${sender} with latency ${duration} ms`);
          sentMessagesSucceed.add(1, {sender, receiver});
          dataReceived.add(data.byteLength, {sender, receiver});
        } else {
          console.error(`[Sender] Message received with incomplete data`);
          sentMessagesFailed.add(1, {sender, receiver});
        }
      });

      socket.on("error", (error) => {
        __ENV.WEBSOCKET_DISCONNECTED = "true";
        console.error(`[Sender] Node ${sender.name} replied with a websocket error:`, error);
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

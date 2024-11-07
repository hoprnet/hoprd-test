import { Options } from "k6/options";
import execution from "k6/execution";
import { Counter, Trend } from "k6/metrics";

import { check, fail, sleep } from "k6";
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
const amountOfSenders = nodesData.filter((node: any) => node.enabled && node.isSender != undefined && node.isSender).length;
const amountOfReceivers = nodesData.filter((node: any) => node.enabled && node.isReceiver != undefined && node.isReceiver).length;

// Read workload options
__ENV.WEBSOCKET_DISCONNECTED = "false";
const workloadName = __ENV.WORKLOAD_NAME || "sanity-check";
let message_delay: number = 1000;
if (__ENV.SCENARIO_ITERATIONS) {
  message_delay = 1000 / parseInt(__ENV.SCENARIO_ITERATIONS);
  console.log(`[Setup] Setting delay between messages to ${message_delay} ms`);
}
const workloadOptions = JSON.parse(open(`./workload-${workloadName}.json`));
//console.log("Test execution options: ");
//console.log(JSON.stringify(workloadOptions))
// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = workloadOptions;

// Define metrics
let messageRequestsSucceed = new Counter("hopr_message_requests_succeed"); // Counts the number of messages requests successfully sent
let sentMessagesSucceed = new Counter("hopr_sent_messages_succeed"); // Counts the number of X hop messages successfully transmitted
let sentMessagesFailed = new Counter("hopr_sent_messages_failed"); // Counts the number of X hop messages failed transmittion
let messageLatency = new Trend("hopr_message_latency");

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  let senders: HoprdNode[] = [];
  let receivers: HoprdNode[] = [];
  nodesData.filter((node: any) => node.enabled)
    .forEach((node: any) => {
      let hoprdNode: HoprdNode = new HoprdNode(node);
      if (hoprdNode.isSender) {
        console.log(`[Setup] Setting up ${hoprdNode.name} as sender`);
        senders.push(hoprdNode);
      }
      if (hoprdNode.isReceiver) {
        console.log(`[Setup] Setting up ${hoprdNode.name} as receiver`);
        receivers.push(hoprdNode);
      }
    });
  //console.log(`Senders: ${JSON.stringify(senders)}`);
  //console.log(`Receivers: ${JSON.stringify(receivers)}`);
  return { senders, receivers };
}

// Scenario to send messages
export function sendMessages(dataPool: {
  senders: HoprdNode[];
  relayers: HoprdNode[];
  receivers: HoprdNode[];
}) {
  const hops = Number(__ENV.HOPS) || 1;
  const senderNodeIndex = Math.ceil((__VU - 1) % amountOfSenders);
  const sender = dataPool.senders[senderNodeIndex];
  //console.log(`VU[${senderNodeIndex}] on scenario[${execution.scenario.name}]`)


  // Set the receiver node
  const receivers = dataPool.receivers.filter((receiver: HoprdNode) => receiver.name != sender.name);
  let receiver;
  if (receivers.length === 0) {
    fail(`[Sender] No receiver nodes available for this VU '${execution.vu.idInInstance}'`);
  } else {
    receiver = receivers[Math.floor(Math.random() * receivers.length)];
  }
  let url = sender.url.replace("http", "ws") + '/session/websocket?';
  url += 'capabilities=Segmentation&capabilities=Retransmission&';
  url += 'target=k6-echo.k6-operator-system.staging.hoprnet.link%3A80&';
  url += 'hops=1&';
  url += `destination=${receiver.peerId}&`;
  url += 'protocol=tcp'; 

  //url = 'ws://localhost:8888';
  //url = 'ws://k6-echo.k6-operator-system.svc:8888';
  //console.log(`Connecting to ${url}`);

  //Open websocket connection to receiver node
  console.log(`[Sender][VU ${senderNodeIndex + 1}] Connecting sender ${sender.name} via websocket to ${receiver.name}`);
  const websocketResponse = ws.connect(url,sender.httpParams,function (socket) {
      socket.on("open", () => {
        console.log(`[Sender][VU ${senderNodeIndex + 1}] Connected via websocket to sender node ${sender.name}`);
        socket.setInterval(function timeout() {
          if (__ENV.WEBSOCKET_DISCONNECTED === "true") {
            console.log(`[Sender][VU:${senderNodeIndex + 1}] Websocket disconnected. Stopping the interval`);
            socket.close();
            return;
          }
          const messagePayload: ArrayBuffer = Utils.buildMessagePayload(sender.name, receiver.name);
          //console.log(`[Sender][VU:${senderNodeIndex + 1}] Sending ${hops} hops message from [${sender.name}] to [${receiver.name}]`);
          socket.sendBinary(messagePayload);
          messageRequestsSucceed.add(1, { sender: sender.name });
        }, message_delay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        const { sender, receiver, startTime } = Utils.unpackMessagePayload(new Uint8Array(data));
        let duration = new Date().getTime() - parseInt(startTime);
        if (sender !== "unknown") {
          messageLatency.add(duration, {sender});
          console.log(`[Sender] Message received on ${receiver} sent from ${sender} with latency ${duration} ms`);
          sentMessagesSucceed.add(1, {sender});
        } else {
          console.error(`[Sender] Message received with incomplete data`);
          sentMessagesFailed.add(1, {sender});
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
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(dataPool: {
  senders: HoprdNode[];
  nodes: HoprdNode[];
}) {
  console.log("[Teardown] Load test finished",);
}

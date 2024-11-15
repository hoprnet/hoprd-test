import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { check, fail } from "k6";
import ws from "k6/ws";
import { HoprdNode } from "./hoprd-node";
import { Utils } from "./utils";
import { K6Configuration } from "./k6-configuration";

// Read nodes
const k6Configuration = new K6Configuration();

// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = k6Configuration.workloadOptions;

// Define metrics
const defaultMetricLabels = { workload: k6Configuration.workload , topology: k6Configuration.topology, hops: k6Configuration.hops.toString() };
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
  switch (k6Configuration.workload) {
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
  switch (k6Configuration.topology) {
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
  return k6Configuration.dataPool.map((route) => {
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
  url += `target=${k6Configuration.targetDestination}%3A80&`;
  url += `hops=${k6Configuration.hops}&`;
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
        let counter = 0;
        socket.setInterval(function timeout() {
          if (__ENV.K6_WEBSOCKET_DISCONNECTED === "true") {
            console.log(`[Sender][VU:${vu + 1}] Websocket disconnected. Stopping the interval`);
            socket.close();
            return;
          }
          const messagePayload: ArrayBuffer = Utils.buildMessagePayload(k6Configuration.targetDestination, counter++);
          //console.log(`[Sender][VU:${vu}] Sending ${k6Configuration.hops} hops message from [${sender.name}] through [${relayer.name}] to [${receiver.name}] with payload ${messagePayload.byteLength} bytes`);
          socket.sendBinary(messagePayload);
          dataSent.add(messagePayload.byteLength, { ...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name });
          messageRequests.add(1, { ...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        }, k6Configuration.messageDelay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        try {
          const startTime = Utils.unpackMessagePayload(new Uint8Array(data), k6Configuration.targetDestination);
          let duration = new Date().getTime() - parseInt(startTime);
          messageLatency.add(duration, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          console.log(`[Sender] Message received on entry node ${sender.name} relayed from ${relayer.name} using exit node ${receiver.name} with latency ${duration} ms`);
          sentMessagesSucceed.add(1, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          dataReceived.add(data.byteLength, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        } catch (error) {
          console.error(`[Sender] Message received on ${sender.name} with incomplete data`);
          sentMessagesFailed.add(1, {...defaultMetricLabels, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          //fail(`[Sender] Message received on ${sender.name} with incomplete data`);
        }
      });

      socket.on("error", (error) => {
        __ENV.K6_WEBSOCKET_DISCONNECTED = "true";
        console.error(`[Sender] Node ${sender.name} replied with a websocket error:`, error);
        fail(`[Sender] Node ${sender.name} replied with a websocket error: ${error}`);
      });
      socket.on("close", (errorCode: any) => {
        __ENV.K6_WEBSOCKET_DISCONNECTED = "true";
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

import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { check, fail } from "k6";
import ws from "k6/ws";
import { HoprdNode } from "./hoprd-node";
import { arrayBufferToString, buildHTTPMessagePayload, unpackMessagePayload } from "./utils";
import { K6Configuration } from "./k6-configuration";

// Read nodes
const k6Configuration = new K6Configuration();

// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = k6Configuration.workloadOptions;

// Define metrics
const messageRequestsSucceed = new Counter("hopr_message_requests_succeed"); // Counts the number of messages requests successfully sent
const messageRequestsFailed = new Counter("hopr_messages_requests_failed"); // Counts the number of X hop messages failed transmittion
const sentMessagesSucceed = new Counter("hopr_sent_messages_succeed"); // Counts the number of X hop messages successfully transmitted
const sentMessagesFailed = new Counter("hopr_sent_messages_failed"); // Counts the number of X hop messages failed transmittion
const messageLatency = new Trend("hopr_message_latency");
const dataSent = new Counter("hopr_data_sent");
const dataReceived = new Counter("hopr_data_received");
const executionInfoMetric = new Gauge("hopr_execution_info");

// The Setup Function is run once before the Load Test https://docs.k6.io/docs/test-life-cycle
export function setup() {
  let routes: { sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }[] = [];
  try {
    routes = k6Configuration.dataPool.map((route) => {
      return { 
        sender: new HoprdNode(route.sender),
        relayer: new HoprdNode(route.relayer),
        receiver: new HoprdNode(route.receiver) 
        };
    });
  } catch (error) {
    console.error(`[Setup] Failed to load data pool:`, error);
    fail(`Failed to load data pool: ${error}`);
  }


  const executionInfoMetricLabels = { 
    duration: k6Configuration.duration.toString(),
    version: routes[0].sender.getVersion(), 
    network: routes[0].sender.getNetwork(),
    topology: k6Configuration.topology,
    workload: k6Configuration.workload,
    hops: k6Configuration.hops.toString(),
    routes: routes.length.toString(),
    vu: k6Configuration.vuPerRoute.toString(), 
    rps: (1000/k6Configuration.messageDelay).toFixed(2).toString(),
  };
  executionInfoMetric.add(Date.now(), executionInfoMetricLabels);
  return routes;
}

// Scenario to send messages
export function sendMessages(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const sender = routes[vu].sender;
  const relayer = routes[vu].relayer;
  const receiver = routes[vu].receiver;
  let websocketOpened = false;
  //console.log(`VU[${senderNodeIndex}] on scenario[${execution.scenario.name}]`)


  let url = sender.url.replace("http", "ws") + '/session/websocket?';
  url += 'capabilities=Segmentation&capabilities=Retransmission&';
  url += `target=${k6Configuration.targetDestination}&`;
  url += `hops=${k6Configuration.hops}&`;
  url += `path=${relayer.peerId}&`;
  url += `destination=${receiver.peerId}&`;
  url += 'protocol=tcp'; 

  //url = 'ws://localhost:8888';
  //url = 'ws://k6-echo.k6-operator-system.svc:8888';
  //console.log(`Url: ${url}`);

  //Open websocket connection to receiver node
  //console.log(`[Sender][VU ${vu + 1}] Connecting via websocket, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);
  let bufferPartialMessage = ""; // Accumulates partial messages
  const websocketResponse = ws.connect(url,sender.httpParams,function (socket) {
      socket.on("open", () => {
        websocketOpened=true;
        //console.log(`[Sender][VU ${vu + 1}] Connected via websocket, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);
        let counter = 0;
        socket.setInterval(function timeout() {
          if (__ENV.K6_WEBSOCKET_DISCONNECTED === "true") {
            console.log(`[Sender][VU:${vu + 1}] Websocket disconnected. Stopping the interval`);
            socket.close();
            return;
          }
          try {
            const messagePayload: ArrayBuffer = buildHTTPMessagePayload(k6Configuration.targetDestination, counter++);
            //console.log(`[Sender][VU:${vu + 1}] Sending ${k6Configuration.hops} hops message from [${sender.name}] through [${relayer.name}] to [${receiver.name}]`);
            socket.sendBinary(messagePayload);
            dataSent.add(messagePayload.byteLength, { sender: sender.name, receiver: receiver.name, relayer: relayer.name });
            messageRequestsSucceed.add(1, { sender: sender.name, receiver: receiver.name, relayer: relayer.name });
          } catch (error) {       
            console.error(`[Sender][VU ${vu + 1}] Failed to send message from [${sender.name}] through [${relayer.name}] to [${receiver.name}]`);
            console.error(`[Sender][VU:${vu + 1}] Failed to send message:`, error);
            messageRequestsFailed.add(1, { sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          }
        }, k6Configuration.messageDelay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        const receivedData = arrayBufferToString(new Uint8Array(data)).trim();
        if (bufferPartialMessage.length > 0) {
          //console.debug(`[Sender][VU ${vu + 1}][Begin] Partial message received on ${sender.name} with data: ${bufferPartialMessage}`);
          bufferPartialMessage += receivedData;
          //console.debug(`[Sender][VU ${vu + 1}][Parsed] Partial message received on ${sender.name} with data: ${bufferPartialMessage}`);
        } else {
          bufferPartialMessage = receivedData;
        }
        try {
          const {startTimes, partialMessage } = unpackMessagePayload(bufferPartialMessage, k6Configuration.targetDestination);
          startTimes.forEach((startTime) => {
            let duration = new Date().getTime() - parseInt(startTime);
            messageLatency.add(duration, { sender: sender.name, receiver: receiver.name, relayer: relayer.name});
            //console.log(`[Sender] Message received on entry node ${sender.name} relayed from ${relayer.name} using exit node ${receiver.name} with latency ${duration} ms`);
            sentMessagesSucceed.add(1, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
            dataReceived.add(data.byteLength, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          });
          bufferPartialMessage = partialMessage; // Update the buffer with the partial message
          if (partialMessage.length > 0) {
            //console.debug(`[Sender][VU ${vu + 1}][End] Partial message received on ${sender.name} with data: ${partialMessage}`);
          }
        } catch (error) {
          console.error(`[Sender][VU ${vu + 1}] Message received on ${sender.name} with incomplete data bufferPartialMessage=${bufferPartialMessage}`);
          console.error(`[Sender][VU ${vu + 1}] Message received on ${sender.name} with incomplete data data=${receivedData}`);
          sentMessagesFailed.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          fail(`[Sender] Message received on ${sender.name} with incomplete data`);
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
export function teardown(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {
  console.log("[Teardown] Load test finished",);
}

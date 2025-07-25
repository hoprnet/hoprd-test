import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { check, fail } from "k6";
import ws from "k6/ws";
import { HoprdNode } from "./hoprd-node";
import { arrayBufferToString, buildHTTPMessagePayload, unpackMessagePayload } from "./utils";
import { WebSocketConfiguration } from "./websocket-configuration";

// Read nodes
const configuration = new WebSocketConfiguration();

// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = configuration.workloadOptions;

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
  let routes: { entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode }[] = [];
  try {
    routes = configuration.dataPool.map((route) => {
      return { 
        entryNode: new HoprdNode(route.entryNode),
        relayerNode: new HoprdNode(route.relayerNode),
        exitNode: new HoprdNode(route.exitNode) 
        };
    });
  } catch (error) {
    console.error(`[Setup] Failed to load data pool:`, error);
    fail(`Failed to load data pool: ${error}`);
  }


  const executionInfoMetricLabels = { 
    duration: configuration.duration.toString(),
    version: routes[0].entryNode.getVersion(), 
    network: routes[0].entryNode.getNetwork(),
    topology: configuration.topology,
    workload: configuration.workload,
    hops: configuration.hops.toString(),
    routes: routes.length.toString(),
    vu: configuration.vuPerRoute.toString(), 
    rps: (1000/configuration.messageDelay).toFixed(2).toString(),
    protocol: 'websocket'
  };
  executionInfoMetric.add(Date.now(), executionInfoMetricLabels);
  return routes;
}

// Scenario to send messages
export function sendMessages(routes: [{ entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const entryNode = routes[vu].entryNode;
  const relayerNode = routes[vu].relayerNode;
  const exitNode = routes[vu].exitNode;
  let websocketOpened = false;
  //console.log(`VU[${vu + 1}] on scenario[${execution.scenario.name}]`)


  let url = entryNode.url.replace("http", "ws") + '/session/websocket?';
  url += 'capabilities=Segmentation&capabilities=Retransmission&';
  url += `target=${configuration.targetDestination}&`;
  url += `hops=${configuration.hops}&`;
  url += `destination=${exitNode.peerAddress}&`;
  url += 'protocol=tcp'; 

  //url = 'ws://localhost:8888';
  //url = 'ws://k6-echo.k6-operator-system.svc:8888';
  //console.log(`Url: ${url}`);

  //Open websocket connection to exit node
  //console.log(`[EntryNode][VU ${vu + 1}] Connecting via websocket, entryNode=${entryNode.name}, relayerNode=${relayerNode.name}, exitNode=${exitNode.name}`);
  let bufferPartialMessage = ""; // Accumulates partial messages
  const websocketResponse = ws.connect(url,entryNode.httpParams,function (socket) {
      socket.on("open", () => {
        websocketOpened=true;
        console.log(`[EntryNode][VU ${vu + 1}] Connected via websocket, entryNode=${entryNode.name}, relayerNode=${relayerNode.name}, exitNode=${exitNode.name}`);
        let counter = 0;
        socket.setInterval(function timeout() {
          if (__ENV.K6_WEBSOCKET_DISCONNECTED === "true") {
            console.log(`[EntryNode][VU:${vu + 1}] Websocket disconnected. Stopping the interval`);
            socket.close();
            return;
          }
          try {
            const messagePayload: ArrayBuffer = buildHTTPMessagePayload(configuration.targetDestination, counter++);
            //console.log(`[EntryNode][VU:${vu + 1}] Sending ${k6Configuration.hops} hops message from [${entryNode.name}] through [${relayerNode.name}] to [${exitNode.name}]`);
            socket.sendBinary(messagePayload);
            dataSent.add(messagePayload.byteLength, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
            messageRequestsSucceed.add(1, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
          } catch (error) {
            console.error(`[EntryNode][VU ${vu + 1}] Failed to send message from [${entryNode.name}] through [${relayerNode.name}] to [${exitNode.name}]`);
            console.error(`[EntryNode][VU:${vu + 1}] Failed to send message:`, error);
            messageRequestsFailed.add(1, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
          }
        }, configuration.messageDelay);
      });
      socket.on('binaryMessage', (data: ArrayBuffer) => {
        const receivedData = arrayBufferToString(new Uint8Array(data)).trim();
        if (bufferPartialMessage.length > 0) {
          //console.debug(`[EntryNode][VU ${vu + 1}][Begin] Partial message received on ${entryNode.name} with data: ${bufferPartialMessage}`);
          bufferPartialMessage += receivedData;
          //console.debug(`[EntryNode][VU ${vu + 1}][Parsed] Partial message received on ${entryNode.name} with data: ${bufferPartialMessage}`);
        } else {
          bufferPartialMessage = receivedData;
        }
        try {
          const {startTimes, partialMessage } = unpackMessagePayload(bufferPartialMessage, configuration.targetDestination);
          startTimes.forEach((startTime) => {
            let duration = new Date().getTime() - parseInt(startTime);
            messageLatency.add(duration, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
            //console.log(`[EntryNode][VU ${vu + 1}] Message received on entry node ${entryNode.name} relayed from ${relayerNode.name} using exit node ${exitNode.name} with latency ${duration} ms`);
            sentMessagesSucceed.add(1, { job: entryNode.nodeName, entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
            dataReceived.add(data.byteLength, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
          });
          bufferPartialMessage = partialMessage; // Update the buffer with the partial message
          if (partialMessage.length > 0) {
            //console.debug(`[EntryNode][VU ${vu + 1}][End] Partial message received on ${entryNode.name} with data: ${partialMessage}`);
          }
        } catch (error) {
          console.error(`[EntryNode][VU ${vu + 1}] Message received on ${entryNode.name} with incomplete data bufferPartialMessage=${bufferPartialMessage}`);
          console.error(`[EntryNode][VU ${vu + 1}] Message received on ${entryNode.name} with incomplete data data=${receivedData}`);
          sentMessagesFailed.add(1, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
          fail(`[EntryNode] Message received on ${entryNode.name} with incomplete data`);
        }
      });

      socket.on("error", (error) => {
        __ENV.K6_WEBSOCKET_DISCONNECTED = "true";
        console.error(`[EntryNode] Node ${entryNode.name} replied with a websocket error:`, error);
        fail(`[EntryNode] Node ${entryNode.name} replied with a websocket error: ${error}`);
      });
      socket.on("close", (errorCode: any) => {
        __ENV.K6_WEBSOCKET_DISCONNECTED = "true";
        console.log(`[EntryNode] Disconnected via websocket from node ${entryNode.name} due to error code ${errorCode} at ${new Date().toISOString()}`,
        );
      });
    },
  );
  check(websocketResponse, { "status is 101": (r) => r && r.status === 101 });
  if (!websocketOpened) {
    fail(`Failed to open a websocket on ${entryNode.name} to ${exitNode.name} trying again`);
  }
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(routes: [{ entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode }]) {
  console.log("[Teardown] Load test finished");
}

import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import {  fail } from "k6";
import tcp from 'k6/x/tcp';
import { HoprdNode } from "./hoprd-node";
import { arrayBufferToString, buildHTTPMessagePayload, buildTCPMessagePayload, unpackMessagePayload } from "./utils";
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
  return routes.map((route) => {
  return {
    sender: route.sender,
    relayer: route.relayer,
    receiver: route.receiver,
    session: route.sender.openSession(route.relayer.peerId, route.receiver.peerId, "tcp", k6Configuration.targetDestination)
    }
  });
}

// Scenario to send messages
export function sendMessages(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode, session: string }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const sender = routes[vu].sender;
  const relayer = routes[vu].relayer;
  const receiver = routes[vu].receiver;
  const tcpListenHost = routes[vu].session;
  

  //const tcpListenHost = sender.openSession(relayer.peerId, receiver.peerId, "tcp", k6Configuration.targetDestination);
  const tcpConnection = tcp.connect(tcpListenHost);
  console.log(`[Sender][VU ${vu + 1}] Connected via tcp session, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);
  const intervalId = setInterval(() => {
    console.log('This runs periodically');
    try{
      const startTime = Date.now();
      tcp.writeLn(tcpConnection, buildTCPMessagePayload());
      dataSent.add(1, { sender: sender.name, receiver: receiver.name, relayer: relayer.name });
      messageRequestsSucceed.add(1, { sender: sender.name, receiver: receiver.name, relayer: relayer.name });
      //let res = String.fromCharCode(...tcp.read(tcpConnection, 1024))
      let response = tcp.read(tcpConnection, 1024)
      console.log(`Response: ${response}`);
      let duration = new Date().getTime() - startTime;
      messageLatency.add(duration, { sender: sender.name, receiver: receiver.name, relayer: relayer.name});
      sentMessagesSucceed.add(1, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
      dataReceived.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});

    } catch(error) {
      console.error(`[Sender][VU ${vu + 1}] Failed to send message from [${sender.name}] through [${relayer.name}] to [${receiver.name}]`);
      console.error(`[Sender][VU:${vu + 1}] Failed to send message:`, error);
      messageRequestsFailed.add(1, { sender: sender.name, receiver: receiver.name, relayer: relayer.name});
      sentMessagesFailed.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});

    }
  }, k6Configuration.messageDelay);

  const timeoutId = setTimeout(() => {
    console.log('This runs during the whole test');
    tcp.close(tcpConnection);
    // clear the timeout and interval to exit k6
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  }, k6Configuration.duration * 60 * 1000);
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {
  console.log("[Teardown] Load test finished",);
}

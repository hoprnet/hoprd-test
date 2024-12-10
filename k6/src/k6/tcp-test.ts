import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { fail } from "k6";
import tcp from 'k6/x/tcp';
import { HoprdNode } from "./hoprd-node";
import { stringToArrayBuffer } from './utils'
import { TCPConfiguration } from "./tcp-configuration";

// Read nodes
const configuration = new TCPConfiguration();

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
  let routes: { sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }[] = [];
  try {
    routes = configuration.dataPool.map((route) => {
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
    duration: configuration.duration.toString(),
    version: routes[0].sender.getVersion(), 
    network: routes[0].sender.getNetwork(),
    topology: configuration.topology,
    workload: configuration.workload,
    hops: configuration.hops.toString(),
    routes: routes.length.toString(),
    vu: configuration.vuPerRoute.toString(), 
  };
  executionInfoMetric.add(Date.now(), executionInfoMetricLabels);
  return routes.map((route) => {
  return {
    sender: route.sender,
    relayer: route.relayer,
    receiver: route.receiver,
    session: route.sender.openSession(route.relayer.peerId, route.receiver.peerId, "tcp", configuration.targetDestination)
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
  //console.log(`[Sender][VU ${vu + 1}] Connecting via tcp session, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);

  const downloadSettings = {
    size: configuration.payloadSize, 
    throughput: configuration.throughput,
    sessionPath: sender.name + ' => ' + relayer.name + ' => ' + receiver.name
  }
  let tcpConnection;
  let testRunning = true;
  setTimeout(() => {
    console.log('This runs during the whole test');
    tcp.close(tcpConnection);
    testRunning = false;
  }, configuration.duration * 60 * 1000);

  while (testRunning) {
    console.log('Opening tcp connection')
    tcpConnection = tcp.connect(tcpListenHost);
    console.log('TCP Connection opened')
    tcp.writeLn(tcpConnection, stringToArrayBuffer(JSON.stringify(downloadSettings)));
    console.log('Start downloading data')
    const initialStartTime = Date.now();
    try {
        while (testRunning) {
          const readStartTime = Date.now();
          const chunk = tcp.read(tcpConnection, configuration.readStreamSize);
          console.log(`Read data with length ${chunk.byteLength}`)
          if (!chunk) { // Connection closed or no more data
            let downloadDuration = (new Date().getTime() - initialStartTime) / 1000;
            console.log(`[Sender][VU ${__VU +1}] Finished to download ${downloadSettings.size} bytes. in ${downloadDuration.toFixed(2)} seconds`);
            break;
          }
          let readDuration = new Date().getTime() - readStartTime;
          messageLatency.add(readDuration, { sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          dataReceived.add(chunk.byteLength, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
          sentMessagesSucceed.add(1, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        }
      } catch (err) {
        console.error(`[Sender][VU ${vu + 1}] Failed to download file via [${sender.name}] => [${relayer.name}] => [${receiver.name}]`);
        console.error(`[Sender][VU:${vu + 1}] Failed to send message:`, err);
        sentMessagesFailed.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        testRunning = false;
      } finally {
        tcp.close(tcpConnection);
      }
    }
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {
  console.log("[Teardown] Load test finished",);
}

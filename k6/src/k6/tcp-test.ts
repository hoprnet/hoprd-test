import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { fail } from "k6";
import tcp from 'k6/x/tcp';
import { HoprdNode } from "./hoprd-node";
import { stringToArrayBuffer } from './utils'
import { SocketConfiguration } from "./socket-configuration";
import { crypto } from 'k6/experimental/webcrypto';


// Read nodes
const configuration = new SocketConfiguration('tcp');

// Test Options https://docs.k6.io/docs/options
export const options: Partial<Options> = configuration.workloadOptions;

// Define metrics
const metricExecutionInfoMetric = new Gauge("hopr_execution_info"); // Contains the execution information
const metricDocumentsSucceed = new Counter("hopr_documents_succeed"); // Counts the number of documents downloaded successfully
const metricDocumentsFailed = new Counter("hopr_documents_failed"); // Counts the number of documents failed transmittion
const metricDataReceived = new Counter("hopr_data_received"); // Counts the number of bytes received
const metricDataSent = new Counter("hopr_data_sent"); // Counts the number of bytes sent
const metricSegmentLatency = new Trend("hopr_segment_latency"); // Latency distribution of downloading/uploading data of size __ENV.K6_DOWNLOAD_SEGMENT_SIZE / __ENV.K6_UPLOAD_SEGMENT_SIZE
const metricDocumentLatency = new Trend("hopr_document_latency"); // Latency distribution of downloading/uploading data of size __ENV.K6_DOWNLOAD_SEGMENT_SIZE / __ENV.K6_UPLOAD_SEGMENT_SIZE


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
    protocol: 'tcp'
  };
  metricExecutionInfoMetric.add(Date.now(), executionInfoMetricLabels);
  
  return routes.map((route) => {
  return {
    sender: route.sender,
    relayer: route.relayer,
    receiver: route.receiver,
    downloadSession: route.sender.openSession(route.relayer, route.receiver, "tcp", configuration.getTargetDestination('download')),
    uploadSession: route.sender.openSession(route.relayer, route.receiver, "tcp", configuration.getTargetDestination('upload'))
    }
  });
}

// Scenario to download data
export function download(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode, downloadSession: string }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const sender = routes[vu].sender;
  const relayer = routes[vu].relayer;
  const receiver = routes[vu].receiver;
  const listenHost = routes[vu].downloadSession;
  //console.log(`[Sender][VU ${vu + 1}] Connecting via tcp session, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);

  const downloadSettings = {
    payloadSize: configuration.payloadSize,
    segmentSize: configuration.downloadSegmentSize,
    throughput: configuration.downloadThroughput,
    sessionPath: sender.name + ' => ' + relayer.name + ' => ' + receiver.name
  }

 
  //console.log(`[Download][VU ${vu +1}] Opening download tcp connection to ${listenHost}`)
  let connection = tcp.connect(listenHost);
  //console.log(`[Download][VU ${__VU}] Opened a downloading TCP Connection to ${listenHost}`)
  tcp.writeLn(connection, stringToArrayBuffer(JSON.stringify(downloadSettings)));

  //console.log(`[Download][VU ${vu +1}] Start downloading data`)
  let downloadedDataSize = 0;
  let downloadedSegmentCount = 0;
  const initialStartTime = Date.now();
  try {
      while (downloadedDataSize < configuration.payloadSize) {
        const readStartTime = Date.now();
        const chunk = tcp.read(connection, configuration.downloadSegmentSize);
        const uint8Array = new Uint8Array(chunk);
        downloadedDataSize += uint8Array.length;
        downloadedSegmentCount++;
        //console.log(`[Download][VU ${__VU}] Downloaded ${downloadedSegmentCount} segments with total data length ${downloadedDataSize / 1024} KB`)
        let readDuration = (new Date().getTime() - readStartTime);
        metricSegmentLatency.add(readDuration, { sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'download' });
        metricDataReceived.add(uint8Array.length, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
      }

      let downloadDurationMiliseconds = (new Date().getTime() - initialStartTime);
      let downloadDurationSeconds = downloadDurationMiliseconds / 1000;
      console.log(`[Download][VU ${__VU}] ${sender.name} downloaded ${(downloadSettings.payloadSize/(1024*1024))} MB in ${downloadDurationSeconds.toFixed(2)} seconds (${(downloadSettings.payloadSize / (downloadDurationSeconds * 1024 * 1024)).toFixed(2)} MB/s) from ${listenHost} through ${relayer.name} to ${receiver.name}`);
      metricDocumentsSucceed.add(1, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'download'});
      metricDocumentLatency.add(downloadDurationMiliseconds, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'download'});
    } catch (err) {
      console.error(`[Download][VU ${vu + 1}] Failed to download file via [${sender.name}] => [${relayer.name}] => [${receiver.name}]`);
      console.error(`[Download][VU:${vu + 1}] Error message:`, err);
      metricDocumentsFailed.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'download'});
    } finally {
      tcp.close(connection);
    }
}

// Scenario to upload data
export function upload(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode, uploadSession: string }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const sender = routes[vu].sender;
  const relayer = routes[vu].relayer;
  const receiver = routes[vu].receiver;
  const listenHost = routes[vu].uploadSession;
  //console.log(`[Sender][VU ${vu + 1}] Connecting via tcp session, sender=${sender.name}, relayer=${relayer.name}, receiver=${receiver.name}`);

  const uploadSettings = {
    payloadSize: configuration.payloadSize,
    segmentSize: configuration.uploadSegmentSize,
    throughput: configuration.uploadThroughput,
    sessionPath: sender.name + ' => ' + relayer.name + ' => ' + receiver.name
  }

 
  //console.log(`[Upload][VU ${vu +1}] Opening upload tcp connection to ${listenHost}`)
  let connection = tcp.connect(listenHost);
  //console.log(`[Upload][VU ${__VU}] Opened an upload TCP Connection to ${listenHost}`)
  tcp.writeLn(connection, stringToArrayBuffer(JSON.stringify(uploadSettings)));

  //console.log(`[Upload][VU ${vu +1}] Start uploading data`)
  let uploadedDataSize = 0;
  let uploadedSegmentCount = 0;
  const initialStartTime = Date.now();
  try {
      while (uploadedDataSize < configuration.payloadSize) {
        const writeStartTime = Date.now();
        const dataSegment = new Uint8Array(configuration.uploadSegmentSize);
        tcp.write(connection, crypto.getRandomValues(dataSegment).buffer);
        //console.log(`Upload data with length ${configuration.uploadSegmentSize}`)
        uploadedDataSize += dataSegment.length;
        uploadedSegmentCount++;
        //console.log(`[Upload][VU ${__VU}] Uploaded ${uploadedSegmentCount} segments with total data length ${uploadedDataSize / 1024} KB`)
        let writeDuration = (new Date().getTime() - writeStartTime);
        metricSegmentLatency.add(writeDuration, { sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'upload' });
        metricDataSent.add(dataSegment.length, {sender: sender.name, receiver: receiver.name, relayer: relayer.name});
        if (uploadedDataSize >= configuration.payloadSize) { // Finished uploading data
          let uploadDurationMiliseconds = (new Date().getTime() - initialStartTime);
          let uploadDurationSeconds = uploadDurationMiliseconds / 1000;
          console.log(`[Upload][VU ${__VU}] ${sender.name} uploaded ${(uploadSettings.payloadSize/(1024*1024))} MB in ${uploadDurationSeconds.toFixed(2)} seconds (${(uploadSettings.payloadSize / (uploadDurationSeconds * 1024 * 1024)).toFixed(2)} MB/s) to ${listenHost} through ${relayer.name} => ${receiver.name}`);
          metricDocumentsSucceed.add(1, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'upload'});
          metricDocumentLatency.add(uploadDurationMiliseconds, {job: sender.nodeName, sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'upload'});
          break;
        }
      }
    } catch (err) {
      console.error(`[Upload][VU ${vu + 1}] Failed to upload file via [${sender.name}] => [${relayer.name}] => [${receiver.name}]`);
      console.error(`[Upload][VU:${vu + 1}] Error message:`, err);
      metricDocumentsFailed.add(1, {sender: sender.name, receiver: receiver.name, relayer: relayer.name, action: 'upload'});
    } finally {
      tcp.close(connection);
    }
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(routes: [{ sender: HoprdNode, relayer: HoprdNode, receiver: HoprdNode }]) {
  console.log("[Teardown] Load test finished",);
}

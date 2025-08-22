import { Options } from "k6/options";
import { Counter, Trend, Gauge } from "k6/metrics";
import { fail, sleep } from "k6";
import udp from 'k6/x/udp';
import { HoprdNode } from "./hoprd-node";
import { stringToArrayBuffer, stringToUint8Array } from './utils'
import { SocketConfiguration } from "./socket-configuration";
import { crypto } from 'k6/experimental/webcrypto';
import exec from 'k6/execution';


// Read nodes
const configuration = new SocketConfiguration('udp');

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
    executionName: configuration.executionName,
    duration: configuration.duration.toString(),
    version: routes[0].entryNode.getVersion(), 
    network: routes[0].entryNode.getNetwork(),
    cluster: configuration.clusterNodes,
    topology: configuration.topology,
    workload: configuration.workload,
    hops: configuration.hops.toString(),
    routes: routes.length.toString(),
    vu: configuration.vuPerRoute.toString(), 
    protocol: 'udp',
    payloadSize: (configuration.payloadSize / (1024 * 1024)).toString(),
    downloadThroughput: (configuration.downloadThroughput / (1024 * 1024)).toFixed(1),
    uploadThroughput: (configuration.uploadThroughput / (1024 * 1024)).toFixed(1),
  };
  metricExecutionInfoMetric.add(Date.now(), executionInfoMetricLabels);
  
  return routes.map((route) => {
    return {
      entryNode: route.entryNode,
      relayerNode: route.relayerNode,
      exitNode: route.exitNode,
      downloadSession: __ENV.K6_SKIP_SCENARIO_DOWNLOAD !== 'true' ? route.entryNode.openSession(route.relayerNode, route.exitNode, "udp", configuration.getTargetDestination('download'), configuration.sessionCapabilities, configuration.sessionMaxSurbUpstream, configuration.sessionResponseBuffer) : null,
      uploadSession: __ENV.K6_SKIP_SCENARIO_UPLOAD !== 'true' ? route.entryNode.openSession(route.relayerNode, route.exitNode, "udp", configuration.getTargetDestination('upload'), configuration.sessionCapabilities, configuration.sessionMaxSurbUpstream, configuration.sessionResponseBuffer) : null
    }
  });
}

// Scenario to download data
export function download(routes: [{ entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode, downloadSession: string }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const entryNode = routes[vu].entryNode;
  const relayerNode = routes[vu].relayerNode;
  const exitNode = routes[vu].exitNode;
  const listenHost = routes[vu].downloadSession;
  //console.log(`[EntryNode][VU ${vu + 1}] Connecting via udp session, entryNode=${entryNode.name}, relayerNode=${relayerNode.name}, exitNode=${exitNode.name}`);

  const downloadSettings = {
    action: 'start',
    payloadSize: configuration.payloadSize,
    segmentSize: configuration.downloadSegmentSize,
    throughput: configuration.downloadThroughput,
    sessionPath: entryNode.name + ' => ' + relayerNode.name + ' => ' + exitNode.name,
    iteration: exec.scenario.iterationInTest,
    iterationTimeout: configuration.iterationTimeout * 1000
  }
  //console.log(`[Download][VU ${__VU}] Opening download udp connection to ${listenHost}`)
  let connection = udp.connectLocalAddress(listenHost, `${configuration.runnerIP}:${10000 + __VU}`, configuration.iterationTimeout);
  console.log(`[Download][VU ${__VU}][ITER ${exec.scenario.iterationInTest}] Opened a downloading UDP Connection from ${connection.localAddr()} to ${listenHost}`)
  udp.writeLn(connection, stringToArrayBuffer(JSON.stringify(downloadSettings)));
  //console.log(`[Download][VU ${__VU}][ITER ${exec.scenario.iterationInTest}] Start downloading data with settings: ${JSON.stringify(downloadSettings)}`);
  let downloadedDataSize = 0;
  let downloadedSegmentCount = 0;
  const initialStartTime = Date.now();
  let timeout = false;
  try {
      while (downloadedDataSize < configuration.payloadSize) {
        const readStartTime = Date.now();
        if ((readStartTime - initialStartTime) > configuration.iterationTimeout * 1000) {
          console.warn(`[Download][VU ${__VU}] Timeout reached, stopping download with ${configuration.payloadSize - downloadedDataSize} bytes remaining, sent ${downloadedSegmentCount} of ${configuration.downloadSegmentSize} segments`);
          timeout = true;
          break;
        }
        //console.log(`[Download][VU ${__VU}][ITER ${exec.scenario.iterationInTest}] Downloading ${configuration.downloadSegmentSize} bytes from ${listenHost}`);
        const chunk = udp.read(connection, configuration.downloadSegmentSize);
        if (!chunk) {
          console.warn(`[Download][VU ${__VU}] Warning: No data received.`);
          //configuration.downloadSegmentSize = Math.max(configuration.downloadSegmentSize / 2, 512);
          continue;
        }
        //console.log(`[Download][VU ${__VU}][ITER ${exec.scenario.iterationInTest}] Downloaded ${downloadedDataSize} bytes from ${listenHost}`);
        const uint8Array = new Uint8Array(chunk);
        downloadedDataSize += uint8Array.length;
        downloadedSegmentCount++;
        let readDuration = (new Date().getTime() - readStartTime);
        metricSegmentLatency.add(readDuration, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'download' });
        metricDataReceived.add(uint8Array.length, {entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name});
      }
      const endSignal = {
        action: 'end',
        startTimestamp: initialStartTime,
        sessionPath: entryNode.name + ' => ' + relayerNode.name + ' => ' + exitNode.name,
      }
      udp.writeLn(connection, stringToArrayBuffer(JSON.stringify(endSignal)));
      if (timeout) {
        metricDocumentsFailed.add(1, {entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'download'});
        return;
      } else {
        let downloadDurationMiliseconds = (new Date().getTime() - initialStartTime);
        let downloadDurationSeconds = downloadDurationMiliseconds / 1000;
        console.log(`[Download][VU ${__VU}] Downloaded ${(downloadSettings.payloadSize/(1024*1024))} MB in ${downloadDurationSeconds.toFixed(2)} seconds (${(downloadSettings.payloadSize / (downloadDurationSeconds * 1024 * 1024)).toFixed(2)} MB/s) using path ${entryNode.name} => ${relayerNode.name} => ${exitNode.name} from ${listenHost}`);
        metricDocumentsSucceed.add(1, {job: entryNode.nodeName, entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'download'});
        metricDocumentLatency.add(downloadDurationMiliseconds, {job: entryNode.nodeName, entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'download'});
      }
    } catch (err) {
      let downloadDurationSeconds = (new Date().getTime() - initialStartTime) / 1000;
      console.error(`[Download][VU ${vu + 1}] Failed to  download file after ${downloadDurationSeconds} seconds using path ${entryNode.name} => ${relayerNode.name} => ${exitNode.name} from ${listenHost}: ${err}`);
      metricDocumentsFailed.add(1, {entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'download'});
    } finally {
      udp.close(connection);
    }
}

// Scenario to upload data
export function upload(routes: [{ entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode, uploadSession: string }]) {

  const vu = Math.ceil((__VU - 1) % routes.length);
  const entryNode = routes[vu].entryNode;
  const relayerNode = routes[vu].relayerNode;
  const exitNode = routes[vu].exitNode;
  const listenHost = routes[vu].uploadSession;
  //console.log(`[EntryNode][VU ${vu + 1}] Connecting via udp session, entryNode=${entryNode.name}, relayerNode=${relayerNode.name}, exitNode=${exitNode.name}`);

  const uploadSettings = {
    payloadSize: configuration.payloadSize,
    segmentSize: configuration.uploadSegmentSize,
    throughput: configuration.uploadThroughput,
    sessionPath: entryNode.name + ' => ' + relayerNode.name + ' => ' + exitNode.name
  }

  //console.log(`[Upload][VU ${vu +1}] Opening upload UDP connection to ${listenHost}`)
  let connection = udp.connect(listenHost);
  //console.log(`[Upload][VU ${__VU}] Opened an upload UDP Connection to ${listenHost}`)

  let uploadedDataSize = 0;
  let uploadedSegmentCount = 0;
  const initialStartTime = Date.now();
  try {
      while (uploadedDataSize < configuration.payloadSize) {
        const writeStartTime = Date.now();
        const dataSegment = new Uint8Array(configuration.uploadSegmentSize);
        udp.write(connection, crypto.getRandomValues(dataSegment).buffer);
        uploadedDataSize += dataSegment.length;
        uploadedSegmentCount++;
        //console.log(`[Upload][VU ${__VU}] Uploaded ${uploadedSegmentCount} segments with total data length ${uploadedDataSize / 1024} KB`)
        let writeDuration = (new Date().getTime() - writeStartTime);
        metricSegmentLatency.add(writeDuration, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'upload' });
        metricDataSent.add(dataSegment.length, { entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name });
        sleep(1 / (configuration.uploadThroughput / configuration.uploadSegmentSize));
      }
      if (uploadedDataSize >= configuration.payloadSize) {
          const endSignal = stringToUint8Array(`END`);
          udp.writeLn(connection, endSignal.buffer);
          let uploadDurationMiliseconds = (new Date().getTime() - initialStartTime);
          let uploadDurationSeconds = uploadDurationMiliseconds / 1000;
          console.log(`[Upload][VU ${__VU}] ${entryNode.name} uploaded ${(uploadSettings.payloadSize/(1024*1024))} MB in ${uploadDurationSeconds.toFixed(2)} seconds (${(uploadSettings.payloadSize / (uploadDurationSeconds * 1024 * 1024)).toFixed(2)} MB/s) to ${listenHost} through ${relayerNode.name} => ${exitNode.name}`);
          metricDocumentsSucceed.add(1, {job: entryNode.nodeName, entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'upload'});
          metricDocumentLatency.add(uploadDurationMiliseconds, {job: entryNode.nodeName, entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'upload'});
      }
  } catch (err) {
      console.error(`[Upload][VU ${vu + 1}] Failed to upload file via [${entryNode.name}] => [${relayerNode.name}] => [${exitNode.name}]`);
      console.error(`[Upload][VU:${vu + 1}] Error message:`, err);
      metricDocumentsFailed.add(1, {entryNode: entryNode.name, exitNode: exitNode.name, relayerNode: relayerNode.name, action: 'upload'});
  } finally {
      udp.close(connection);
  }
}

// The Teardown Function is run once after the Load Test https://docs.k6.io/docs/test-life-cycle
export function teardown(_routes: [{ entryNode: HoprdNode, relayerNode: HoprdNode, exitNode: HoprdNode }]) {
  console.log("[Teardown] Load test finished");
}

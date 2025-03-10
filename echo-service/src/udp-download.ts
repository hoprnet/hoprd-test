import dgram from 'dgram';
import { randomBytes } from 'crypto';

const bindingPort = 3012;

const socketServer = dgram.createSocket('udp4');

// Store active clients and their intervals
const activeClients = new Map<string, { interval: NodeJS.Timeout; timeout: NodeJS.Timeout }>();


socketServer.on('listening', () => {
    const address = socketServer.address();
    console.log(`[UDP][Download] Server listening on ${address.address}:${address.port}`);
});

socketServer.on('message', (message, remoteInfo) => {
    const clientKey = `${remoteInfo.address}:${remoteInfo.port}`; // Unique identifier for each client
    let parsedMessage: any = {}
    let dataSent = 0;
    //console.log(`[UDP][Download] Client connected from ${clientKey}`);
    try{
         parsedMessage = JSON.parse(message.toString().trim());
    } catch (err) {
        console.log('[UDP][Download] Received wrong message:', message.toString());
    }
    if (parsedMessage.action === "start") {
        const payloadSize = parsedMessage.payloadSize; // Data in bytes
        const segmentSize = parsedMessage.segmentSize; // Data in bytes
        const throughput = parsedMessage.throughput; // bytes/s
        const segmentsPerSecond = throughput / segmentSize;
        const payloadSizeMB = (payloadSize / (1024 * 1024 )).toFixed(2); // MB
        const throughputMB = (throughput / (1024 * 1024)).toFixed(2); // MB/s
        let segmentsSent = 0;
        console.log(`[UDP][Download] Downloading ${payloadSizeMB} MB at ${throughputMB} MB/s ( ${segmentsPerSecond.toFixed(0)} segments/s) over UDP using session path ${parsedMessage.sessionPath}`);
        // Prevent duplicate intervals if the same client sends multiple requests
        if (activeClients.has(clientKey)) {
            console.warn(`[UDP][Download] Client ${clientKey} already has an active session. Reactivating...`);
        }
        let interval = setInterval(() => {
            const dataChunk = randomBytes(segmentSize);
            socketServer.send(dataChunk, remoteInfo.port, remoteInfo.address, (err) => {
                if (err) {
                    console.error("[UDP][Download] Error sending data:", err.message);
                    clearInterval(interval);
                    clearTimeout(timeout);
                    activeClients.delete(clientKey);
                    return;
                }
                dataSent += dataChunk.length;
                segmentsSent++;
                //console.log(`[UDP][Download] Sent ${segmentsSent} segments with ${dataSent} bytes in total.`);
            });
        }, 1000 / segmentsPerSecond);
        // **Timeout fallback to prevent infinite sending**
        let timeout = setTimeout(() => {
            console.warn(`[UDP][Download] Timeout: No end signal received from ${parsedMessage.sessionPath}, stopping transmission.`);
            clearInterval(interval);
            activeClients.delete(clientKey);
        }, parsedMessage.iterationTimeout);
        // Store client session
        activeClients.set(clientKey, { interval, timeout });
    } else if (parsedMessage.action === "end") {
        const { interval, timeout } = activeClients.get(clientKey)!;
        const duration = (Date.now() - parsedMessage.startTimestamp) / 1000; // In seconds
        console.log(`[UDP][Download] Download finished in ${duration.toFixed(2)} seconds using session path ${parsedMessage.sessionPath}`);
        clearInterval(interval);
        clearTimeout(timeout);
        if (activeClients.has(clientKey)){
            activeClients.delete(clientKey);
        }
    } else {
            console.warn(`[UDP][Download] Unknown or unexpected message from ${clientKey}:`, parsedMessage);
    }
});

// Handle socket errors
socketServer.on('error', (err) => {
    console.error(`[UDP][Download] Server error: ${err.message}`);
    // Optionally close the server on a critical error
    socketServer.close(() => {
        console.log('[UDP][Download] Server closed due to an error');
    });
});

socketServer.on('close', () => {
    console.log('[UDP][Download] Server closed');
});
socketServer.bind(bindingPort);
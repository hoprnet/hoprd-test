import dgram from 'dgram';
import { randomBytes } from 'crypto';

const bindingPort = 3012;

const socketServer = dgram.createSocket('udp4');

socketServer.on('listening', () => {
    const address = socketServer.address();
    console.log(`[UDP][Download] Server listening on ${address.address}:${address.port}`);
});

socketServer.on('message', (message, remoteInfo) => {
    console.log(`[UDP][Download] Client connected from ${remoteInfo.address}:${remoteInfo.port}`);
    
    const downloadSettingsString = message.toString();
    console.log('[UDP][Download] Received download settings:', downloadSettingsString);

    let dataSent = 0;
    const startTime = Date.now();

        try{
            const downloadSettings = JSON.parse(downloadSettingsString.toString());
            const payloadSize = downloadSettings.payloadSize; // Data in bytes
            const segmentSize = downloadSettings.segmentSize; // Data in bytes
            const throughput = downloadSettings.throughput; // bytes/s
            const segmentsPerSecond = throughput / segmentSize;
            const payloadSizeMB = (payloadSize / (1024 * 1024 )).toFixed(2); // MB
            const throughputMB = (throughput / (1024 * 1024)).toFixed(2); // MB/s
            let segmentsSent = 0;
            console.log(`[UDP][Download] Downloading ${payloadSizeMB} MB at ${throughputMB} MB/s ( ${segmentsPerSecond.toFixed(0)} segments/s) over UDP using session path ${downloadSettings.sessionPath}`);
            const interval = setInterval(() => {
                    const dataChunk = randomBytes(segmentSize);
                    if (dataSent < payloadSize) {
                        socketServer.send(dataChunk, remoteInfo.port, remoteInfo.address, (err) => {
                            if (err) {
                                console.error('[UDP][Download] Error sending data:', err.message);
                                clearInterval(interval);
                                return;
                            }
                            dataSent += dataChunk.length;
                            segmentsSent++;
                            //console.log(`[UDP][Download] Sent ${segmentsSent} segments with ${dataSent} bytes in total.`);
                        })
                    } else {
                        clearInterval(interval);
                        const endTime = Date.now();
                        const duration = (endTime - startTime) / 1000; // In seconds
                        const speed = ((payloadSize) / duration) / (1024 * 1024); // MB/s
                        console.log(`[UDP][Download] Download finished: ${payloadSizeMB} MB sent in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s) using session path ${downloadSettings.sessionPath}`);
                    }
            }, 1000 / segmentsPerSecond );
        } catch (err) {
            console.error(`[UDP][Download] Error handling message from ${remoteInfo.address}:${remoteInfo.port}`);
            console.error("[UDP][Download] Error parsing download settings or sending data:", err);
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
import net from 'net';
import { randomBytes } from 'crypto';

const bindingPort = 3002;

// TCP Server options
const tcpOptions = {
    highWaterMark: 64 * 1024 
};

const socketServer = net.createServer(tcpOptions, (socket) => {
    console.log(`[TCP][Download] Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
    let dataSent = 0;
    const startTime = Date.now();

    socket.on('data', (downloadSettingsString) => {
        //console.log(`Download settings received with: ${downloadSettingsString.toString()}`);
        try{
            const downloadSettings = JSON.parse(downloadSettingsString.toString());
            const payloadSize = downloadSettings.payloadSize; // Data in bytes
            const segmentSize = downloadSettings.segmentSize; // Data in bytes
            const throughput = downloadSettings.throughput; // bytes/s
            const segmentsPerSecond = throughput / segmentSize;
            const payloadSizeMB = (payloadSize / (1024 * 1024)).toFixed(2); // MB
            const throughputMB = (throughput / (1024 * 1024)).toFixed(2); // MB/s
            let segmentsSent = 0;
            console.log(`[TCP][Download] Downloading ${payloadSizeMB} MB at ${throughputMB} MB/s ( ${segmentsPerSecond.toFixed(0)} segments/s) over TCP using session ${downloadSettings.sessionPath}`);
            const interval = setInterval(() => {
                if (socket.writable && !socket.destroyed) {
                    const chunk = randomBytes(segmentSize);
                    if (dataSent < payloadSize) {
                        socket.write(chunk);
                        dataSent+= chunk.length;
                        segmentsSent++;
                        //console.log(`[TCP][Download] Sent ${segmentsSent} segments with ${dataSent} bytes in total.`);
                    } else {
                        clearInterval(interval);
                        socket.end();
                        const endTime = Date.now();
                        const duration = (endTime - startTime) / 1000; // In seconds
                        const speed = ((payloadSize) / duration) / (1024 * 1024); // MB/s
                        console.log(`[TCP][Download] Download finished: ${payloadSizeMB} GB sent in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s)`);
                    }
                } else {
                    if (socket.destroyed) {
                        console.log("[TCP][Download] Socket is destroyed, stopping data transfer.");
                        clearInterval(interval);
                        socket.end();
                        const endTime = Date.now();
                        const duration = (endTime - startTime) / 1000; // In seconds
                        const speed = ((payloadSize) / duration) / (1024 * 1024); // MB/s
                        console.log(`[TCP][Download] Download unfinished: ${payloadSizeMB} GB sent in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s)`);
                    } else {
                        console.log("[TCP][Download] Client not ready, pausing data transfer.");
                        socket.pause();
                    }
                }
            }, 1000 / segmentsPerSecond );
        } catch (err) {
            console.error("[TCP][Download] Error parsing download settings or sending data:", err);
            socket.end();
        }
    });

    // Handle Backpressure
    socket.on('drain', () => {
        if (!socket.destroyed) {
            console.log('[TCP][Download] Client ready again, resuming data transfer.');
            socket.resume();
        } else {
            console.log('[TCP][Download] Socket is destroyed, not resuming.');
        }
    });

    socket.on('error', (err: any) => {
        if (err.code === 'ECONNRESET') {
            console.log('[TCP][Download] Connection reset by client.');
        } else {
            console.error('[TCP][Download] Socket error:', err);
        }
    });

    socket.on('end', () => {
        console.log('[TCP][Download] Client disconnected gracefully.');
        socket.destroy(); // Ensure the socket is fully closed
    });

    socket.on('close', (hadError) => {
        socket.removeAllListeners();
        console.log(`[TCP][Download] Socket closed. Error occurred: ${hadError}`);
    });
});

socketServer.on('error', (err) => {
    console.error('[TCP][Download] Server error:', err);
});

socketServer.listen(bindingPort, () => {
    console.log(`[TCP][Download] Server listening on 0.0.0.0:${bindingPort}`);
});
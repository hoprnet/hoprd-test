import net from 'net';
import { randomBytes } from 'crypto';

const downloadPort = 3002; // Port for download test

const downloadServer = net.createServer((socket) => {
    console.log("Client connected for download test");
    let chunksSent = 0;
    const startTime = Date.now();

    socket.on('data', (downloadSettingsString) => {
        const downloadSettings = JSON.parse(downloadSettingsString.toString());
        const payloadSize = downloadSettings.size; // Data in bytes
        const throughput = downloadSettings.throughput; // bytes/s
        const payloadSizeGB = (payloadSize / (1024 * 1024 * 1024)).toFixed(2); // GB
        const throughputMB = (throughput / (1024 * 1024)).toFixed(2); // MB/s
        console.log(`Downloading ${payloadSizeGB} GB at ${throughputMB} MB/s over TCP using session ${downloadSettings.sessionPath}`);

        const interval = setInterval(() => {
            const chunk = randomBytes(throughput);
            if (chunksSent < payloadSize) {
                socket.write(chunk);
                chunksSent+= throughput;
            } else {
                clearInterval(interval);
                socket.end();
                const endTime = Date.now();
                const duration = (endTime - startTime) / 1000; // In seconds
                const speed = ((payloadSize) / duration) / (1024 * 1024); // MB/s
                console.log(`Download finished: ${payloadSizeGB} GB sent in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s)`);
            }
        }, 1);
    });

    socket.on('error', (err) => {
        console.error("Download server error:", err);
    });
});

downloadServer.listen(downloadPort, () => {
    console.log(`Download server listening on port ${downloadPort}`);
});
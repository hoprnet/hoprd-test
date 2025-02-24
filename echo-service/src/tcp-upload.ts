import net from 'net';

const bindingPort = 3001;

// **Upload Test**
const socketServer = net.createServer((socket) => {
    console.log(`[TCP][Upload] Client connected from ${socket.remoteAddress}:${socket.remotePort}`);

    let totalBytes = 0;
    const startTime = Date.now();

    socket.on('data', (chunk) => {
        //console.log(`Received ${chunk.length} bytes`);
        totalBytes += chunk.length;
    });

    socket.on('end', () => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000; // In seconds
        const speed = (totalBytes / duration) / (1024 * 1024); // MB/s
        console.log(`[TCP][Upload] Upload finished: ${totalBytes} bytes received in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s)`);
    });

    socket.on('error', (err) => {
        console.error("[TCP][Upload] Server error:", err);
    });
});

socketServer.listen(bindingPort, () => {
    console.log(`[TCP][Upload] Server listening on 0.0.0.0:${bindingPort}`);
});

import net from 'net';

const uploadPort = 3001; // Port for upload test

// **Upload Test**
const uploadServer = net.createServer((socket) => {
    console.log("Client connected for upload test");

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
        console.log(`Upload finished: ${totalBytes} bytes received in ${duration.toFixed(2)} seconds (${speed.toFixed(2)} MB/s)`);
    });

    socket.on('error', (err) => {
        console.error("Upload server error:", err);
    });
});

uploadServer.listen(uploadPort, () => {
    console.log(`Upload server listening on port ${uploadPort}`);
});

import dgram from 'dgram';

const bindingPort = 3011;

// **Upload Test**
const socketServer = dgram.createSocket('udp4');

socketServer.on('listening', () => {
    const address = socketServer.address();
    console.log(`[UDP][Upload] Server listening on ${address.address}:${address.port}`);
});

socketServer.on('message', (message, remoteInfo) => {
    if (message.toString().startsWith('END')) {
        console.log(`[UDP][Upload] Upload finished from ${remoteInfo.address}:${remoteInfo.port}`);
    } else {
        //console.log(`[UDP][Upload] Data (${message.length} bytes) received from ${remoteInfo.address}:${remoteInfo.port}`);
    }
});

// Handle socket errors
socketServer.on('error', (err) => {
    console.error(`[UDP][Upload] Server error: ${err.message}`);
    // Optionally close the server on a critical error
    socketServer.close(() => {
        console.log('[UDP][Upload] Server closed due to an error');
    });
});

socketServer.on('close', () => {
    console.log('[UDP][Upload] Server closed');
});

socketServer.bind(bindingPort);
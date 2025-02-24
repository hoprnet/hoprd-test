import WebSocket, { WebSocketServer } from 'ws';

// Set up the WebSocket server
const port = 8888;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');

  ws.on('message', (message: Buffer, isBinary: boolean) => {
    // Log the received binary message
    if (isBinary) {
      const messageString = arrayBufferToString(message);
      const fields = messageString.substring(messageString.indexOf('?'), messageString.lastIndexOf(' HTTP') + 1);
      const [sender, receiver, startTime] = fields.split('&').map((field) => field.split('=')[1]);
      console.log('[WebSocket] Received binary data:', arrayBufferToString(message))
      const replyMessage = `HTTP/1.1 200 OKDate: Thu, 07 Nov 2024 07:53:37 GMTContent-Type: application/json; charset=utf-8Content-Length: 89Connection: keep-aliveX-Powered-By: ExpressETag: W/"59-O9qhlozVfW4uteOBAOQnVURtayI"{"message":{"sender":"${sender}","receiver":"${receiver}","startTime":"${startTime}"}}`;

      // Echo the binary data back to the client
      ws.send(stringToArrayBuffer(replyMessage), { binary: true });
    } else {
      console.log('[WebSocket] Received non-binary message:', message.toString());
      ws.send('This server only supports binary data.');
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
});

console.log(`[WebSocket] Server listening on port ${port}`);

function stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length);
    const bufferView = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
        bufferView[i] = str.charCodeAt(i);
    }
    return buffer;
}

function arrayBufferToString(buffer: ArrayBuffer): string {
    const bufferView = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bufferView.length; i++) {
        const charCode = bufferView[i];
        // Only append printable ASCII characters
        if (charCode >= 32 && charCode <= 126) {
            str += String.fromCharCode(charCode);
        }
    }
    //str = str.trim();
    return str;
}
#!/bin/sh

# Start the HTTP server
node /app/dist/http.js &

# Start the WebSocket server
node /app/dist/websocket.js &

# Start the TCP server
node /app/dist/tcp-download.js &
node /app/dist/tcp-upload.js &

# Start the UDP server
node /app/dist/udp-download.js &
node /app/dist/udp-upload.js &

# Wait for any background jobs to finish (keeps the container running)
wait
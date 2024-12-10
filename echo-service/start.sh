#!/bin/sh

# Start the HTTP server
node /app/dist/index.js &

# Start the WebSocket server
node /app/dist/websocket.js &

# Wait for any background jobs to finish (keeps the container running)
wait
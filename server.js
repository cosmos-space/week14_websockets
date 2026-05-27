// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static frontend files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// 1. Create a standard HTTP Server wrapping our Express app
const server = http.createServer(app);

// 2. Initialize the WebSocket Server instance, attaching it to our HTTP Server
const wss = new WebSocket.Server({ server });

// Track connected clients
const clients = new Set();

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  // Add new socket connection to our tracker set
  clients.add(ws);
  console.log(`[WS] Client connected. Total active connections: ${clients.size}`);

  // Welcome message to the newly connected client only
  ws.send(
    JSON.stringify({
      type: 'system',
      message: 'Connected to local WebSockets Server! Welcome to the chat.',
    })
  );

  // Listen for incoming messages from this client
  ws.on('message', (rawData) => {
    try {
      // Buffer data must be parsed to a string
      const parsedData = JSON.parse(rawData.toString());
      console.log(`[WS] Received message:`, parsedData);

      // Broadcast message to all active clients (excluding sender optional, but here we send to everyone)
      const broadcastPayload = JSON.stringify({
        type: 'chat',
        username: parsedData.username || 'Anonymous',
        message: parsedData.message,
        timestamp: new Date().toLocaleTimeString(),
      });

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastPayload);
        }
      });
    } catch (error) {
      console.error('[WS] Error processing message:', error.message);
    }
  });

  // Handle Socket Disconnections
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total active connections: ${clients.size}`);
  });
});

// 3. HTTP REST Endpoint: Push Notification Trigger
app.post('/api/notify', (req, res) => {
  const { notification } = req.body;

  if (!notification) {
    return res
      .status(400)
      .json({ error: "Missing 'notification' parameter in request body." });
  }

  console.log(`[HTTP REST] Triggering push broadcast: ${notification}`);

  // Construct the notification payload
  const notificationPayload = JSON.stringify({
    type: 'notification',
    message: notification,
    timestamp: new Date().toLocaleTimeString(),
  });

  // Broadcast the notification out to all active WebSocket clients!
  let activeReceivers = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(notificationPayload);
      activeReceivers++;
    }
  });

  res.status(200).json({
    success: true,
    message: `Notification pushed to ${activeReceivers} active client sessions.`,
  });
});

// Start our combined HTTP and WebSocket Server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[SYSTEM] Server listening for HTTP & WS on http://localhost:${PORT}`);
});


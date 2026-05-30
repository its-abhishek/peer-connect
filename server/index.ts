import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage } from './signaling';
import { leaveRoom } from './rooms';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();
const server = http.createServer(app);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const wss = new WebSocketServer({ server });

const userConnectionMap = new Map<WebSocket, string | null>();

wss.on('connection', (ws: WebSocket) => {
  console.log('[Server] Client connected');
  userConnectionMap.set(ws, null);

  ws.on('message', (rawData) => {
    let parsed: { type?: string; senderId?: string } = {};
    try {
      parsed = JSON.parse(rawData.toString());
    } catch {
      return;
    }

    if (parsed.type === 'create-room' || parsed.type === 'join-room') {
      const msg = JSON.parse(rawData.toString());
      userConnectionMap.set(ws, msg.senderId || null);
    }

    handleMessage(ws, rawData);
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    const userId = userConnectionMap.get(ws) || undefined;
    if (userId) {
      const { roomId, otherUserIds } = leaveRoom(userId);
      if (roomId) {
        broadcastToRoom(ws, roomId, {
          type: 'user-left',
          payload: { userId },
        });
      }
    }
    userConnectionMap.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err.message);
  });
});

function broadcastToRoom(senderWs: WebSocket, roomId: string, message: object): void {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Signaling server running on port ${PORT}`);
  console.log(`[Server] WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
});

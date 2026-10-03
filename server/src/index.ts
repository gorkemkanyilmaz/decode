import http from 'http';
import { WebSocketServer } from 'ws';
import { RoomManager } from './rooms/RoomManager';
import { WebSocketHandler } from './network/WebSocketHandler';

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', activeRooms: roomManager.getActiveRoomCount() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DECODED: 3D Number Hunt Server is active.\n');
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();
const wsHandler = new WebSocketHandler(roomManager);

wss.on('connection', (ws) => {
  wsHandler.handleConnection(ws);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DECODED Server] Authoritative game server listening on http://localhost:${PORT}`);
  console.log(`[DECODED Server] WebSocket server ready on ws://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n[DECODED Server] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

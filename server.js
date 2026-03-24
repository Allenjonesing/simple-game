/**
 * Word Warriors — Multiplayer Server
 * Node.js + Socket.io — real-time 1v1 word battle rooms.
 *
 * Setup:
 *   npm install
 *   node server.js
 *   Open http://localhost:3000 in two browser windows.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;

// Serve static files from project root
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────────────────────
// Room management
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, Room>} */
const rooms = new Map();

/**
 * @typedef {object} Room
 * @property {string} code
 * @property {RoomPlayer[]} players
 * @property {boolean} started
 * @property {number} turn  0 or 1
 */

/**
 * @typedef {object} RoomPlayer
 * @property {string} socketId
 * @property {string} name
 * @property {number} index  0 or 1
 * @property {string[]} rack  letter tiles
 */

function generateRoomCode() {
  let code;
  let attempts = 0;
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    attempts++;
  } while (rooms.has(code) && attempts < 100);
  return code;
}

// Mirror of the server-side tile bag (must match js/game.js distribution)
const TILE_BAG_TEMPLATE = {
  A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1,
  K:1, L:4, M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6,
  U:4, V:2, W:2, X:1, Y:2, Z:1, '★':2,
};

function buildTileBag() {
  const bag = [];
  for (const [letter, count] of Object.entries(TILE_BAG_TEMPLATE)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  return shuffle(bag);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawTiles(bag, rack, count = 10) {
  while (rack.length < 10 && bag.length > 0 && count > 0) {
    rack.push(bag.pop());
    count--;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io events
// ─────────────────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log(`[connect] ${socket.id}`);

  socket.on('createRoom', ({ name }) => {
    const code = generateRoomCode();
    const bag = buildTileBag();
    const rack = [];
    drawTiles(bag, rack, 10);

    const room = {
      code,
      bag,
      players: [{
        socketId: socket.id,
        name: (name || 'Warrior').slice(0, 20),
        index: 0,
        rack,
      }],
      started: false,
      turn: 0,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;

    socket.emit('roomCreated', { roomCode: code, playerIndex: 0 });
    console.log(`[room] ${code} created by ${name}`);
  });

  socket.on('joinRoom', ({ name, roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error', { message: `Room "${code}" not found.` });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', { message: `Room "${code}" is full.` });
      return;
    }
    if (room.started) {
      socket.emit('error', { message: `Game in room "${code}" already started.` });
      return;
    }

    const rack = [];
    drawTiles(room.bag, rack, 10);
    const player = {
      socketId: socket.id,
      name: (name || 'Warrior').slice(0, 20),
      index: 1,
      rack,
    };
    room.players.push(player);
    room.started = true;
    socket.join(code);
    socket.roomCode = code;

    socket.emit('roomJoined', { roomCode: code, playerIndex: 1 });

    // Notify both players to start
    const turnOrder = Math.random() < 0.5 ? 0 : 1;
    room.turn = turnOrder;

    io.to(code).emit('gameStart', {
      players: room.players.map(p => ({ name: p.name, rack: p.rack })),
      turnOrder,
    });
    console.log(`[room] ${code} started — ${room.players[0].name} vs ${room.players[1].name}`);
  });

  socket.on('playWord', ({ word, selectedWord, room: roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) return;
    if (room.turn !== playerIndex) {
      socket.emit('error', { message: 'Not your turn!' });
      return;
    }

    const player = room.players[playerIndex];

    // Remove used tiles from server-side rack
    const usedIndices = selectedWord.map(s => s.rackIdx).sort((a, b) => b - a);
    for (const idx of usedIndices) player.rack.splice(idx, 1);

    // Draw replacement tiles
    drawTiles(room.bag, player.rack, 10 - player.rack.length);

    // Flip turn
    room.turn = playerIndex === 0 ? 1 : 0;

    // Broadcast to all in room
    io.to(roomCode).emit('wordPlayed', {
      playerIndex,
      word,
      selectedWord,
      newRack: player.rack,
    });
  });

  socket.on('pass', ({ room: roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1 || room.turn !== playerIndex) return;

    const player = room.players[playerIndex];
    const discardCount = Math.min(3, player.rack.length);
    player.rack.splice(0, discardCount);
    drawTiles(room.bag, player.rack, 10 - player.rack.length);
    room.turn = playerIndex === 0 ? 1 : 0;

    io.to(roomCode).emit('opponentPassed', { playerIndex, newRack: player.rack });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    // Notify remaining player
    socket.to(roomCode).emit('opponentLeft', { message: 'Your opponent disconnected.' });
    rooms.delete(roomCode);
  });
});

server.listen(PORT, () => {
  console.log(`\n⚔️  Word Warriors server running at http://localhost:${PORT}\n`);
});

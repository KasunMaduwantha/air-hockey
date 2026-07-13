const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ==========================================
// CONSTANTS
// ==========================================
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 500;
const PADDLE_RADIUS = 35;
const PADDLE_RADIUS_BIG = 55;
const PUCK_RADIUS = 20;
const GOAL_WIDTH = 200;
const PUCK_FRICTION = 0.995;
const MAX_PUCK_SPEED = 20;
const WIN_SCORE = 7;

// Power-ups
const POWERUP_SPAWN_INTERVAL = 8000;
const POWERUP_RADIUS = 20;
const POWERUP_DURATION = 5000;
const POWERUP_TYPES = ['speed', 'bigPaddle', 'freeze', 'multiHit'];

// ==========================================
// GAME STATE
// ==========================================
let gameState = {
  players: {},
  puck: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0 },
  score: { player1: 0, player2: 0 },
  gameRunning: false,
  gameOver: false,
  winner: null,
  goalScored: false,
  powerUps: []
};

let powerUpTimer = null;
let lastPuckHitter = null;

// ==========================================
// HELPERS
// ==========================================
function resetPuck(direction) {
  gameState.puck = {
    x: TABLE_WIDTH / 2,
    y: TABLE_HEIGHT / 2,
    vx: direction ? direction * 2 : 0,
    vy: (Math.random() - 0.5) * 2
  };
}

function resetPlayers() {
  Object.values(gameState.players).forEach(p => {
    if (p.side === 'left') {
      p.x = 150;
      p.y = TABLE_HEIGHT / 2;
    } else {
      p.x = TABLE_WIDTH - 150;
      p.y = TABLE_HEIGHT / 2;
    }
    p.vx = 0;
    p.vy = 0;
    p.powerUp = null;
    p.powerUpEnds = 0;
    p.frozen = false;
    p.frozenUntil = 0;
  });
}

function assignSide() {
  const players = Object.values(gameState.players);
  if (players.filter(p => p.side === 'left').length === 0) return 'left';
  if (players.filter(p => p.side === 'right').length === 0) return 'right';
  return null;
}

function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Player';
  name = name.trim().substring(0, 12).replace(/[^a-zA-Z0-9_\- ]/g, '');
  return name.length === 0 ? 'Player' : name;
}

function getPaddleRadius(paddle) {
  return paddle.powerUp === 'bigPaddle' ? PADDLE_RADIUS_BIG : PADDLE_RADIUS;
}

// ==========================================
// POWER-UPS
// ==========================================
function spawnPowerUp() {
  if (!gameState.gameRunning || gameState.goalScored) return;
  if (gameState.powerUps.length >= 2) return;

  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

  const powerUp = {
    id: Date.now(),
    type: type,
    x: 200 + Math.random() * (TABLE_WIDTH - 400),
    y: 100 + Math.random() * (TABLE_HEIGHT - 200),
    createdAt: Date.now()
  };

  gameState.powerUps.push(powerUp);
  io.emit('powerUpSpawned', { powerUp });
}

function checkPowerUpCollision(puck) {
  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const p = gameState.powerUps[i];
    const dx = puck.x - p.x;
    const dy = puck.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PUCK_RADIUS + POWERUP_RADIUS) {
      const lastHitter = gameState.players[lastPuckHitter];
      if (lastHitter) {
        applyPowerUp(lastHitter, p.type);
        io.emit('powerUpCollected', {
          type: p.type,
          playerId: lastHitter.id,
          playerName: lastHitter.name,
          x: p.x,
          y: p.y
        });
      }
      gameState.powerUps.splice(i, 1);
    }
  }
}

function applyPowerUp(player, type) {
  const now = Date.now();

  switch (type) {
    case 'speed':
      player.powerUp = 'speed';
      player.powerUpEnds = now + POWERUP_DURATION;
      break;

    case 'bigPaddle':
      player.powerUp = 'bigPaddle';
      player.powerUpEnds = now + POWERUP_DURATION;
      break;

    case 'freeze':
      const opponent = Object.values(gameState.players).find(p => p.side !== player.side);
      if (opponent) {
        opponent.frozen = true;
        opponent.frozenUntil = now + 2000;
      }
      break;

    case 'multiHit':
      gameState.puck.vx *= 1.5;
      gameState.puck.vy *= 1.5;
      break;
  }
}

function updatePowerUps() {
  const now = Date.now();

  Object.values(gameState.players).forEach(p => {
    if (p.powerUp && now > p.powerUpEnds) {
      p.powerUp = null;
      p.powerUpEnds = 0;
    }
    if (p.frozen && now > p.frozenUntil) {
      p.frozen = false;
      p.frozenUntil = 0;
    }
  });

  gameState.powerUps = gameState.powerUps.filter(p => now - p.createdAt < 25000);
}

// ==========================================
// COLLISION
// ==========================================
function checkPaddlePuckCollision(paddle, puck) {
  const paddleRadius = getPaddleRadius(paddle);
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = paddleRadius + PUCK_RADIUS;

  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = minDist - dist;
    puck.x += nx * overlap;
    puck.y += ny * overlap;

    const paddleSpeed = Math.sqrt(paddle.vx * paddle.vx + paddle.vy * paddle.vy);

    const dotProduct = puck.vx * nx + puck.vy * ny;
    puck.vx = puck.vx - 2 * dotProduct * nx + paddle.vx * 0.7;
    puck.vy = puck.vy - 2 * dotProduct * ny + paddle.vy * 0.7;

    if (paddle.powerUp === 'speed') {
      puck.vx *= 1.4;
      puck.vy *= 1.4;
    }

    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    if (speed < 4 + paddleSpeed) {
      const newSpeed = 4 + paddleSpeed;
      const angle = Math.atan2(puck.vy, puck.vx);
      puck.vx = Math.cos(angle) * newSpeed;
      puck.vy = Math.sin(angle) * newSpeed;
    }

    lastPuckHitter = paddle.id;

    io.emit('paddleHit', {
      x: puck.x,
      y: puck.y,
      speed: speed,
      side: paddle.side
    });

    return true;
  }
  return false;
}

function constrainPaddle(paddle) {
  const radius = getPaddleRadius(paddle);
  paddle.y = Math.max(radius, Math.min(TABLE_HEIGHT - radius, paddle.y));

  if (paddle.side === 'left') {
    paddle.x = Math.max(radius, Math.min(TABLE_WIDTH / 2 - radius, paddle.x));
  } else {
    paddle.x = Math.max(TABLE_WIDTH / 2 + radius, Math.min(TABLE_WIDTH - radius, paddle.x));
  }
}

// ==========================================
// GOAL CHECK
// ==========================================
function checkGoal() {
  if (gameState.goalScored) return;

  const puck = gameState.puck;
  const goalTop = (TABLE_HEIGHT - GOAL_WIDTH) / 2;
  const goalBottom = TABLE_HEIGHT - goalTop;

  if (puck.x - PUCK_RADIUS <= 10 && puck.y > goalTop && puck.y < goalBottom) {
    gameState.score.player2++;
    gameState.goalScored = true;
    const scorer = Object.values(gameState.players).find(p => p.side === 'right');
    io.emit('goalScored', {
      side: 'right',
      scorerName: scorer ? scorer.name : 'Player 2',
      score: gameState.score,
      puckX: puck.x,
      puckY: puck.y
    });
    checkWin();
    setTimeout(() => {
      resetPuck(-1);
      resetPlayers();
      gameState.goalScored = false;
    }, 2000);
  }

  if (puck.x + PUCK_RADIUS >= TABLE_WIDTH - 10 && puck.y > goalTop && puck.y < goalBottom) {
    gameState.score.player1++;
    gameState.goalScored = true;
    const scorer = Object.values(gameState.players).find(p => p.side === 'left');
    io.emit('goalScored', {
      side: 'left',
      scorerName: scorer ? scorer.name : 'Player 1',
      score: gameState.score,
      puckX: puck.x,
      puckY: puck.y
    });
    checkWin();
    setTimeout(() => {
      resetPuck(1);
      resetPlayers();
      gameState.goalScored = false;
    }, 2000);
  }
}

function checkWin() {
  if (gameState.score.player1 >= WIN_SCORE) {
    gameState.gameOver = true;
    gameState.gameRunning = false;
    const winner = Object.values(gameState.players).find(p => p.side === 'left');
    io.emit('gameOver', {
      winner: winner ? winner.name : 'Player 1',
      side: 'left',
      score: gameState.score
    });
    stopPowerUpTimer();
  } else if (gameState.score.player2 >= WIN_SCORE) {
    gameState.gameOver = true;
    gameState.gameRunning = false;
    const winner = Object.values(gameState.players).find(p => p.side === 'right');
    io.emit('gameOver', {
      winner: winner ? winner.name : 'Player 2',
      side: 'right',
      score: gameState.score
    });
    stopPowerUpTimer();
  }
}

function startPowerUpTimer() {
  stopPowerUpTimer();
  powerUpTimer = setInterval(() => {
    spawnPowerUp();
  }, POWERUP_SPAWN_INTERVAL);
}

function stopPowerUpTimer() {
  if (powerUpTimer) {
    clearInterval(powerUpTimer);
    powerUpTimer = null;
  }
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop() {
  if (gameState.gameOver) return;

  const puck = gameState.puck;

  if (!gameState.goalScored && gameState.gameRunning) {
    puck.x += puck.vx;
    puck.y += puck.vy;

    puck.vx *= PUCK_FRICTION;
    puck.vy *= PUCK_FRICTION;

    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    if (speed > MAX_PUCK_SPEED) {
      const ratio = MAX_PUCK_SPEED / speed;
      puck.vx *= ratio;
      puck.vy *= ratio;
    }

    if (puck.y - PUCK_RADIUS < 0) {
      puck.y = PUCK_RADIUS;
      puck.vy = Math.abs(puck.vy);
      io.emit('wallBounce', { x: puck.x, y: puck.y });
    }
    if (puck.y + PUCK_RADIUS > TABLE_HEIGHT) {
      puck.y = TABLE_HEIGHT - PUCK_RADIUS;
      puck.vy = -Math.abs(puck.vy);
      io.emit('wallBounce', { x: puck.x, y: puck.y });
    }

    const goalTop = (TABLE_HEIGHT - GOAL_WIDTH) / 2;
    const goalBottom = TABLE_HEIGHT - goalTop;

    if (puck.x - PUCK_RADIUS < 0) {
      if (puck.y < goalTop || puck.y > goalBottom) {
        puck.x = PUCK_RADIUS;
        puck.vx = Math.abs(puck.vx);
        io.emit('wallBounce', { x: puck.x, y: puck.y });
      }
    }
    if (puck.x + PUCK_RADIUS > TABLE_WIDTH) {
      if (puck.y < goalTop || puck.y > goalBottom) {
        puck.x = TABLE_WIDTH - PUCK_RADIUS;
        puck.vx = -Math.abs(puck.vx);
        io.emit('wallBounce', { x: puck.x, y: puck.y });
      }
    }

    Object.values(gameState.players).forEach(paddle => {
      checkPaddlePuckCollision(paddle, puck);
    });

    checkPowerUpCollision(puck);
    updatePowerUps();
    checkGoal();
  }

  io.emit('gameState', {
    players: gameState.players,
    puck: gameState.puck,
    score: gameState.score,
    gameRunning: gameState.gameRunning,
    goalScored: gameState.goalScored,
    gameOver: gameState.gameOver,
    powerUps: gameState.powerUps
  });
}

setInterval(gameLoop, 1000 / 60);

// ==========================================
// SOCKET EVENTS
// ==========================================
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('joinGame', (data) => {
    const side = assignSide();
    if (!side) {
      socket.emit('gameFull');
      return;
    }

    const playerName = sanitizeName(data.name);
    const startX = side === 'left' ? 150 : TABLE_WIDTH - 150;

    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName,
      side: side,
      x: startX,
      y: TABLE_HEIGHT / 2,
      vx: 0,
      vy: 0,
      prevX: startX,
      prevY: TABLE_HEIGHT / 2,
      powerUp: null,
      powerUpEnds: 0,
      frozen: false,
      frozenUntil: 0
    };

    console.log(`${playerName} joined as ${side}`);

    socket.emit('playerAssigned', {
      id: socket.id,
      name: playerName,
      side: side
    });

    if (Object.keys(gameState.players).length === 2 && !gameState.gameRunning) {
      gameState.gameRunning = true;
      gameState.gameOver = false;
      gameState.score = { player1: 0, player2: 0 };
      gameState.powerUps = [];
      resetPuck(Math.random() > 0.5 ? 1 : -1);
      resetPlayers();
      io.emit('gameStart');
      startPowerUpTimer();
    }

    io.emit('playerJoined', {
      players: Object.values(gameState.players).map(p => ({
        name: p.name, side: p.side
      }))
    });
  });

  socket.on('movePaddle', (data) => {
    const paddle = gameState.players[socket.id];
    if (!paddle) return;
    if (paddle.frozen) return;

    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
    paddle.x = data.x;
    paddle.y = data.y;
    constrainPaddle(paddle);

    paddle.vx = paddle.x - paddle.prevX;
    paddle.vy = paddle.y - paddle.prevY;
  });

  socket.on('restartGame', () => {
    if (Object.keys(gameState.players).length < 2) return;

    gameState.score = { player1: 0, player2: 0 };
    gameState.gameOver = false;
    gameState.gameRunning = true;
    gameState.goalScored = false;
    gameState.powerUps = [];
    resetPuck(Math.random() > 0.5 ? 1 : -1);
    resetPlayers();
    startPowerUpTimer();

    io.emit('gameRestarted');
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    const name = player ? player.name : 'Unknown';
    console.log(`${name} disconnected`);

    delete gameState.players[socket.id];

    if (Object.keys(gameState.players).length < 2) {
      gameState.gameRunning = false;
      gameState.gameOver = false;
      stopPowerUpTimer();
    }

    if (Object.keys(gameState.players).length === 0) {
      gameState.score = { player1: 0, player2: 0 };
      gameState.powerUps = [];
      resetPuck(0);
    }

    io.emit('playerLeft', { name });
    io.emit('playerJoined', {
      players: Object.values(gameState.players).map(p => ({
        name: p.name, side: p.side
      }))
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🏒 Air Hockey running on port ${PORT}`);
});
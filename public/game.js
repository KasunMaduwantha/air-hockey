const socket = io();

let myId = null;
let mySide = null;
let myName = null;
let gameState = null;
let soundEnabled = true;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 500;
const PADDLE_RADIUS = 35;
const PADDLE_RADIUS_BIG = 55;
const PUCK_RADIUS = 20;
const GOAL_WIDTH = 200;
const POWERUP_RADIUS = 20;

let particles = [];

// ==========================================
// SOUND SYSTEM
// ==========================================
let audioContext = null;

function initAudio() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error('Web Audio not supported');
  }
}

function playSound(type, intensity = 1) {
  if (!soundEnabled || !audioContext) return;

  try {
    switch (type) {
      case 'hit': playHitSound(intensity); break;
      case 'wall': playWallSound(); break;
      case 'goal': playGoalSound(); break;
      case 'powerUp': playPowerUpSound(); break;
      case 'win': playWinSound(); break;
      case 'freeze': playFreezeSound(); break;
    }
  } catch (e) {
    console.error('Sound error:', e);
  }
}

function playHitSound(intensity) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(200 + intensity * 30, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.15);
}

function playWallSound() {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.1);
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.1);
}

function playGoalSound() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.3);
    }, i * 100);
  });

  setTimeout(() => {
    const bufferSize = audioContext.sampleRate * 0.8;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    noise.start(audioContext.currentTime);
  }, 200);
}

function playPowerUpSound() {
  const notes = [440, 554, 659, 880];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(0.15, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.2);
    }, i * 60);
  });
}

function playFreezeSound() {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
  gain.gain.setValueAtTime(0.2, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.5);
}

function playWinSound() {
  const notes = [523, 659, 784, 1046, 1318, 1568];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.4);
    }, i * 150);
  });
}

// Sound toggle
const soundBtn = document.getElementById('soundToggle');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('hockeySoundEnabled', soundEnabled);
  });
}

const savedSound = localStorage.getItem('hockeySoundEnabled');
if (savedSound !== null) {
  soundEnabled = savedSound === 'true';
  if (soundBtn) soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
}

// ==========================================
// FULLSCREEN
// ==========================================
const fullscreenBtn = document.getElementById('fullscreenBtn');
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  });
}

function tryFullscreen() {
  if (window.innerWidth <= 900 && !document.fullscreenElement) {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
  }
}

// ==========================================
// SHARE BUTTON
// ==========================================
const shareBtn = document.getElementById('shareBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '🏒 Air Hockey',
          text: 'Come play air hockey with me!',
          url: url
        });
      } catch (err) { console.log('Share cancelled'); }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = '✅ Copied!';
        setTimeout(() => { shareBtn.textContent = '📤 Share Link'; }, 2000);
      } catch (err) {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        shareBtn.textContent = '✅ Copied!';
        setTimeout(() => { shareBtn.textContent = '📤 Share Link'; }, 2000);
      }
    }
  });
}

// ==========================================
// NAME INPUT
// ==========================================
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');

const savedName = localStorage.getItem('hockeyName');
if (savedName) nameInput.value = savedName;
nameInput.focus();

joinBtn.addEventListener('click', joinGame);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinGame();
});

function joinGame() {
  const name = nameInput.value.trim();
  if (name.length === 0) {
    nameInput.style.border = '2px solid #ef5350';
    nameInput.placeholder = 'Please enter a name!';
    return;
  }
  initAudio();
  localStorage.setItem('hockeyName', name);
  myName = name;
  document.getElementById('nameScreen').style.display = 'none';
  document.getElementById('waitingScreen').style.display = 'flex';
  socket.emit('joinGame', { name });
}

// ==========================================
// INPUT - MOUSE + TOUCH
// ==========================================
canvas.addEventListener('mousemove', (e) => {
  if (!myId || !gameState) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * TABLE_WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * TABLE_HEIGHT;
  socket.emit('movePaddle', { x, y });
});

let touchActive = false;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchActive = true;
  if (!myId || !gameState) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = ((touch.clientX - rect.left) / rect.width) * TABLE_WIDTH;
  const y = ((touch.clientY - rect.top) / rect.height) * TABLE_HEIGHT;
  socket.emit('movePaddle', { x, y });
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchActive || !myId || !gameState) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = ((touch.clientX - rect.left) / rect.width) * TABLE_WIDTH;
  const y = ((touch.clientY - rect.top) / rect.height) * TABLE_HEIGHT;
  socket.emit('movePaddle', { x, y });
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  touchActive = false;
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  touchActive = false;
}, { passive: false });

// Prevent zoom on double tap
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

// ==========================================
// PARTICLES
// ==========================================
function createHitParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 3,
      color: color,
      life: 1.0,
      decay: 0.03
    });
  }
}

function createGoalParticles(x, y, color) {
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 6,
      color: [color, '#FFD700', '#FFF', '#ff69b4'][Math.floor(Math.random() * 4)],
      life: 1.0,
      decay: 0.015,
      gravity: 0.1
    });
  }

  for (let i = 0; i < 30; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 100,
      y: y + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 3 - 2,
      size: 6 + Math.random() * 4,
      color: '#FFD700',
      life: 1.5,
      decay: 0.02,
      isStar: true
    });
  }
}

function createPowerUpParticles(x, y, color) {
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: 4 + Math.random() * 3,
      color: color,
      life: 1.0,
      decay: 0.025,
      sparkle: true
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.gravity) p.vy += p.gravity;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;

    if (p.isStar) {
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 5);
      drawStar(0, 0, 5, p.size, p.size / 2);
    } else if (p.sparkle) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size, p.y);
      ctx.lineTo(p.x + p.size, p.y);
      ctx.moveTo(p.x, p.y - p.size);
      ctx.lineTo(p.x, p.y + p.size);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

// ==========================================
// DRAWING
// ==========================================
function drawTable() {
  const gradient = ctx.createLinearGradient(0, 0, TABLE_WIDTH, 0);
  gradient.addColorStop(0, '#1a3a5a');
  gradient.addColorStop(0.5, '#0f2a4a');
  gradient.addColorStop(1, '#1a3a5a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 10]);
  ctx.beginPath();
  ctx.moveTo(TABLE_WIDTH / 2, 0);
  ctx.lineTo(TABLE_WIDTH / 2, TABLE_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 80, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(79,195,247,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, TABLE_HEIGHT / 2, 120, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(239,83,80,0.4)';
  ctx.beginPath();
  ctx.arc(TABLE_WIDTH, TABLE_HEIGHT / 2, 120, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  drawGoals();

  ctx.strokeStyle = '#8888aa';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, TABLE_WIDTH - 8, TABLE_HEIGHT - 8);
}

function drawGoals() {
  const goalTop = (TABLE_HEIGHT - GOAL_WIDTH) / 2;

  ctx.fillStyle = 'rgba(79,195,247,0.2)';
  ctx.fillRect(0, goalTop, 10, GOAL_WIDTH);
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, goalTop);
  ctx.lineTo(0, goalTop);
  ctx.lineTo(0, goalTop + GOAL_WIDTH);
  ctx.lineTo(10, goalTop + GOAL_WIDTH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(239,83,80,0.2)';
  ctx.fillRect(TABLE_WIDTH - 10, goalTop, 10, GOAL_WIDTH);
  ctx.strokeStyle = '#ef5350';
  ctx.beginPath();
  ctx.moveTo(TABLE_WIDTH - 10, goalTop);
  ctx.lineTo(TABLE_WIDTH, goalTop);
  ctx.lineTo(TABLE_WIDTH, goalTop + GOAL_WIDTH);
  ctx.lineTo(TABLE_WIDTH - 10, goalTop + GOAL_WIDTH);
  ctx.stroke();
}

function drawPaddle(paddle, isMe) {
  const color = paddle.side === 'left' ? '#4fc3f7' : '#ef5350';
  const darkColor = paddle.side === 'left' ? '#0277bd' : '#c62828';
  const radius = paddle.powerUp === 'bigPaddle' ? PADDLE_RADIUS_BIG : PADDLE_RADIUS;

  if (paddle.frozen) {
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150,220,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#66aaff';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (paddle.powerUp === 'speed') {
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  if (paddle.powerUp === 'bigPaddle') {
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(paddle.x + 3, paddle.y + 5, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(paddle.x, paddle.y, radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    paddle.x - 10, paddle.y - 10, 5,
    paddle.x, paddle.y, radius
  );
  grad.addColorStop(0, color);
  grad.addColorStop(1, darkColor);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(paddle.x, paddle.y, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = darkColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(paddle.x, paddle.y, radius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = isMe ? '#FFD700' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = isMe ? 3 : 2;
  ctx.beginPath();
  ctx.arc(paddle.x, paddle.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (isMe) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', paddle.x, paddle.y - radius - 8);
  }
}

function drawPuck(puck) {
  const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);

  if (speed > 5) {
    for (let i = 1; i <= 5; i++) {
      const alpha = (5 - i) / 15;
      ctx.beginPath();
      ctx.arc(
        puck.x - puck.vx * i * 0.5,
        puck.y - puck.vy * i * 0.5,
        PUCK_RADIUS * (1 - i * 0.1),
        0, Math.PI * 2
      );
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.arc(puck.x + 2, puck.y + 4, PUCK_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  const grad = ctx.createRadialGradient(
    puck.x - 5, puck.y - 5, 2,
    puck.x, puck.y, PUCK_RADIUS
  );
  grad.addColorStop(0, '#666');
  grad.addColorStop(0.7, '#222');
  grad.addColorStop(1, '#000');

  ctx.beginPath();
  ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, PUCK_RADIUS * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(puck.x, puck.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#666';
  ctx.fill();
}

function drawPowerUp(p) {
  const t = Date.now() * 0.005;
  const bob = Math.sin(t + p.id) * 3;
  const pulse = 1 + Math.sin(t * 2) * 0.1;

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.scale(pulse, pulse);

  const colors = {
    speed: ['#FFD700', '#FFA500'],
    bigPaddle: ['#00ff88', '#00aa55'],
    freeze: ['#66ccff', '#0088ff'],
    multiHit: ['#ff4488', '#cc0044']
  };

  const [c1, c2] = colors[p.type] || ['#fff', '#888'];

  ctx.beginPath();
  ctx.arc(0, 0, POWERUP_RADIUS + 8, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, POWERUP_RADIUS + 8);
  glow.addColorStop(0, c1 + '99');
  glow.addColorStop(1, c1 + '00');
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, POWERUP_RADIUS, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, POWERUP_RADIUS);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  const icons = {
    speed: '⚡', bigPaddle: '🛡️',
    freeze: '❄️', multiHit: '🔥'
  };

  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(icons[p.type], 0, 0);

  ctx.restore();
}

// ==========================================
// RENDER LOOP
// ==========================================
function render() {
  ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  drawTable();

  if (gameState) {
    if (gameState.powerUps) {
      gameState.powerUps.forEach(p => drawPowerUp(p));
    }

    Object.values(gameState.players).forEach(paddle => {
      drawPaddle(paddle, paddle.id === myId);
    });

    drawPuck(gameState.puck);
  }

  updateParticles();
  drawParticles();

  requestAnimationFrame(render);
}

// ==========================================
// SOCKET EVENTS
// ==========================================
socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('gameFull', () => {
  document.getElementById('waitingScreen').style.display = 'none';
  document.getElementById('gameFullScreen').style.display = 'flex';
});

socket.on('playerAssigned', (data) => {
  myId = data.id;
  mySide = data.side;
  myName = data.name;

  const status = document.getElementById('waitStatus');
  status.textContent = `You are Player ${data.side === 'left' ? '1' : '2'}`;
});

socket.on('playerJoined', (data) => {
  const players = data.players;
  players.forEach(p => {
    const el = document.getElementById(p.side === 'left' ? 'player1Name' : 'player2Name');
    if (el) el.textContent = p.name;
  });

  if (players.length < 2) {
    const other = players[0];
    if (other && other.side === 'left') {
      document.getElementById('player1Name').textContent = other.name;
      document.getElementById('player2Name').textContent = 'Waiting...';
    } else if (other && other.side === 'right') {
      document.getElementById('player2Name').textContent = other.name;
      document.getElementById('player1Name').textContent = 'Waiting...';
    }
  }
});

socket.on('gameStart', () => {
  document.getElementById('waitingScreen').style.display = 'none';
  document.getElementById('gameFullScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';

  const infoEl = document.getElementById('mySideInfo');
  const color = mySide === 'left' ? '#4fc3f7' : '#ef5350';
  infoEl.innerHTML = `You: <strong style="color:${color}">${mySide === 'left' ? 'LEFT' : 'RIGHT'}</strong>`;

  tryFullscreen();
  render();
});

socket.on('gameState', (state) => {
  gameState = state;
  updateScore(state.score);
  updatePowerUpIndicators();
});

socket.on('paddleHit', (data) => {
  playSound('hit', data.speed);
  const color = data.side === 'left' ? '#4fc3f7' : '#ef5350';
  createHitParticles(data.x, data.y, color, 10);
});

socket.on('wallBounce', (data) => {
  playSound('wall');
  createHitParticles(data.x, data.y, 'rgba(255,255,255,0.7)', 6);
});

socket.on('goalScored', (data) => {
  playSound('goal');
  showGoal(data.side, data.scorerName);
  updateScore(data.score);

  const color = data.side === 'left' ? '#4fc3f7' : '#ef5350';
  createGoalParticles(data.puckX || TABLE_WIDTH / 2, data.puckY || TABLE_HEIGHT / 2, color);
});

socket.on('powerUpSpawned', (data) => {
  createPowerUpParticles(data.powerUp.x, data.powerUp.y, '#FFD700');
});

socket.on('powerUpCollected', (data) => {
  const colors = {
    speed: '#FFD700', bigPaddle: '#00ff88',
    freeze: '#66ccff', multiHit: '#ff4488'
  };

  if (data.type === 'freeze') playSound('freeze');
  else playSound('powerUp');

  createPowerUpParticles(data.x, data.y, colors[data.type] || '#fff');

  const notif = document.getElementById('powerUpNotif');
  const icons = {
    speed: '⚡ SPEED',
    bigPaddle: '🛡️ BIG PADDLE',
    freeze: '❄️ FREEZE',
    multiHit: '🔥 MULTI HIT'
  };

  notif.textContent = `${data.playerName}: ${icons[data.type]}`;
  notif.style.background = colors[data.type];
  notif.style.opacity = 1;

  setTimeout(() => { notif.style.opacity = 0; }, 2000);
});

socket.on('gameOver', (data) => {
  playSound('win');
  document.getElementById('gameOverScreen').style.display = 'flex';
  document.getElementById('gameScreen').style.display = 'none';

  const color = data.side === 'left' ? '#4fc3f7' : '#ef5350';
  document.getElementById('winnerText').innerHTML =
    `<span style="color:${color}">${data.winner}</span> Wins!`;
  document.getElementById('finalScore').textContent =
    `${data.score.player1} — ${data.score.player2}`;
});

socket.on('gameRestarted', () => {
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';
  particles = [];
});

// ==========================================
// UI
// ==========================================
function updateScore(score) {
  document.getElementById('score1').textContent = score.player1;
  document.getElementById('score2').textContent = score.player2;
}

function updatePowerUpIndicators() {
  if (!gameState) return;

  Object.values(gameState.players).forEach(p => {
    const el = document.getElementById(p.side === 'left' ? 'power1' : 'power2');
    if (!el) return;

    if (p.powerUp) {
      const icons = {
        speed: '⚡',
        bigPaddle: '🛡️'
      };
      const timeLeft = Math.ceil((p.powerUpEnds - Date.now()) / 1000);
      el.textContent = `${icons[p.powerUp] || ''} ${timeLeft}s`;
      el.style.display = 'block';
    } else if (p.frozen) {
      el.textContent = '❄️ FROZEN';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

let goalTimer = null;
function showGoal(side, scorerName) {
  const popup = document.getElementById('goalPopup');
  const color = side === 'left' ? '#4fc3f7' : '#ef5350';

  document.getElementById('goalScorer').textContent = `⚡ ${scorerName}`;
  document.getElementById('goalScorer').style.color = color;

  popup.style.display = 'flex';

  if (goalTimer) clearTimeout(goalTimer);
  goalTimer = setTimeout(() => {
    popup.style.display = 'none';
  }, 1800);
}

document.getElementById('restartBtn').addEventListener('click', () => {
  socket.emit('restartGame');
});
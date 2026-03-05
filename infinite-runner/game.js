const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const killsEl = document.getElementById("killsValue");
const healthEl = document.getElementById("healthValue");
const healthFillEl = document.getElementById("healthFill");
const speedEl = document.getElementById("speedValue");
const musicToggleEl = document.getElementById("musicToggle");
const mobileHealthEl = document.getElementById("mobileHealthValue");
const mobileScoreEl = document.getElementById("mobileScoreValue");
const mobileBestEl = document.getElementById("mobileBestValue");
const mobileModeEl = document.getElementById("mobileModeValue");
const pauseBtnEl = document.getElementById("pauseBtn");
const leftBtnEl = document.getElementById("leftBtn");
const rightBtnEl = document.getElementById("rightBtn");
const fireBtnEl = document.getElementById("fireBtn");
const titlebarEl = document.querySelector(".titlebar");
const mobileStatusShellEl = document.querySelector(".mobile-status");
const mobileControlsShellEl = document.querySelector(".mobile-controls");

const MOBILE_QUERY = window.matchMedia("(max-width: 900px) and (pointer: coarse)");

const STORAGE_KEY = "space-runner-best-kills";
const WORLD_MAX_Z = 120;
const PLAYER_Z = 10;
const SPARK_CAP = 120;
const SHOT_CAP = 12;
const FRAGMENT_CAP = 220;
const BLAST_CAP = 28;
const BONUS_CAP = 6;
const SHAKE_CAP = 1.6;
const MISSES_TO_DESTROY = 25;
const SHIP_HEALTH_MAX = 100;
const STAR_COUNT = 220;
const BASE_SPEED = 34;
const MAX_SPEED = 84;
const SPEED_ACCEL_START = 1.0;
const SPEED_ACCEL_END = 0.26;
const SPAWN_GAP_START_MIN = 0.76;
const SPAWN_GAP_START_MAX = 1.08;
const SPAWN_GAP_FLOOR_START = 0.66;
const SPAWN_GAP_FLOOR_MIN = 0.34;
const SPAWN_GAP_VARIANCE = 0.38;
const SPAWN_GAP_DECAY = 0.0035;
const STACKED_UNLOCK_DISTANCE = 360;
const STACKED_BASE_CHANCE = 0.1;
const STACKED_MAX_CHANCE = 0.26;
const STACKED_Z_OFFSET_MIN = 7.2;
const STACKED_Z_OFFSET_MAX = 12.4;

const ASSET_ROOT = "./assets/pixel_v2";

const ATLAS_CELL = 256;
const ATLAS_COLS = 8;

const PLAYER_ANIMS = {
  idle: [0],
  run: [1, 2, 3, 4, 5, 6, 7, 8],
  shift_left: [9, 10, 11, 12],
  shift_right: [13, 14, 15, 16],
  jump_up: [17, 18, 19],
  fall: [20, 21],
  land: [22, 23],
  hit: [24, 25, 26],
};

const ALIEN_ARCHETYPES = [
  { type: "sentinel", weight: 1.1, jumpClear: 2.7, yOffset: 0.0, scale: [0.9, 1.08], hover: false },
  { type: "behemoth", weight: 0.95, jumpClear: 2.95, yOffset: 0.02, scale: [0.96, 1.22], hover: false },
  { type: "cephalid", weight: 0.92, jumpClear: 2.62, yOffset: 0.06, scale: [0.9, 1.12], hover: true },
  { type: "stalker", weight: 1.04, jumpClear: 2.54, yOffset: 0.0, scale: [0.88, 1.08], hover: false },
  { type: "leviathan", weight: 0.78, jumpClear: 3.08, yOffset: 0.08, scale: [0.94, 1.16], hover: true },
  { type: "spinebeast", weight: 0.86, jumpClear: 2.86, yOffset: 0.02, scale: [0.9, 1.14], hover: false },
];

function readBestScore() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  } catch (_) {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (_) {
    // Ignore storage errors.
  }
}

const state = {
  phase: "ready",
  width: 960,
  height: 520,
  isMobileViewport: MOBILE_QUERY.matches,
  speed: BASE_SPEED,
  distance: 0,
  kills: 0,
  shipHealth: SHIP_HEALTH_MAX,
  missedAliens: 0,
  bestKills: readBestScore(),
  time: 0,
  spawnTimer: 0,
  nextSpawn: 1,
  bonusTimer: 0,
  nextBonus: 8,
  spawnGapFloor: SPAWN_GAP_FLOOR_START,
  lastTime: performance.now(),
  cameraShake: 0,
  powerupFlash: 0,
  powerupFlashX: 0.5,
  powerupFlashY: 0.58,
  powerupHue: 132,
  touchStart: null,
  sparks: [],
  shots: [],
  fragments: [],
  blasts: [],
  bonuses: [],
  obstacles: [],
  stars: [],
  assets: {
    ready: false,
    error: null,
    playerAtlas: null,
  },
  player: {
    lane: 0,
    prevLane: 0,
    targetLane: 0,
    jumpY: 0,
    prevJumpY: 0,
    jumpVelocity: 0,
    shiftTimer: 0,
    shiftDir: 0,
    landTimer: 0,
    hitFlash: 0,
    runClock: 0,
    fireCooldown: 0,
    sprayTimer: 0,
  },
  mobile: {
    leftPointerId: null,
    rightPointerId: null,
    leftInterval: null,
    rightInterval: null,
    firePointerId: null,
    fireInterval: null,
  },
};

const physics = {
  gravity: 52,
  jumpVelocity: 20,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

const audioState = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuffer: null,
  noiseKey: "",
  musicStarted: false,
  musicNext: 0,
  musicStep: 0,
  musicEnabled: true,
};

function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioState.ctx) {
    audioState.ctx = new AudioCtx();
    audioState.master = audioState.ctx.createGain();
    audioState.master.gain.value = 0.92;
    audioState.sfxBus = audioState.ctx.createGain();
    audioState.musicBus = audioState.ctx.createGain();
    audioState.sfxBus.gain.value = 0.2;
    audioState.musicBus.gain.value = audioState.musicEnabled ? 0.12 : 0.0001;
    audioState.sfxBus.connect(audioState.master);
    audioState.musicBus.connect(audioState.master);
    audioState.master.connect(audioState.ctx.destination);
  }

  if (audioState.ctx.state === "suspended") {
    audioState.ctx.resume().catch(() => {});
  }
  return audioState.ctx;
}

function getNoiseBuffer(seconds = 0.22) {
  const ctx = ensureAudio();
  if (!ctx) return null;

  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const channels = 1;
  const key = `${seconds}:${ctx.sampleRate}`;
  if (audioState.noiseBuffer && audioState.noiseKey === key) {
    return audioState.noiseBuffer;
  }

  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = random(-1, 1) * (1 - i / length);
  }
  audioState.noiseBuffer = buffer;
  audioState.noiseKey = key;
  return buffer;
}

function playTone(type, freqStart, freqEnd, duration, gainStart, gainEnd = 0.0001) {
  const ctx = ensureAudio();
  if (!ctx || !audioState.sfxBus) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
  gain.gain.setValueAtTime(Math.max(0.0001, gainStart), now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnd), now + duration);
  osc.connect(gain);
  gain.connect(audioState.sfxBus);
  osc.start(now);
  osc.stop(now + duration);
}

function playNoise(duration, gainStart, gainEnd, hp = 250, lp = 5000) {
  const ctx = ensureAudio();
  const buffer = getNoiseBuffer(duration);
  if (!ctx || !buffer || !audioState.sfxBus) return;

  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = "highpass";
  hpFilter.frequency.value = hp;

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = "lowpass";
  lpFilter.frequency.value = lp;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, gainStart), now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnd), now + duration);

  src.connect(hpFilter);
  hpFilter.connect(lpFilter);
  lpFilter.connect(gain);
  gain.connect(audioState.sfxBus);
  src.start(now);
  src.stop(now + duration + 0.02);
}

function playShootSfx() {
  playTone("square", 720, 260, 0.08, 0.06, 0.0001);
  playTone("triangle", 190, 110, 0.09, 0.04, 0.0001);
  playNoise(0.05, 0.04, 0.0001, 1200, 9800);
}

function playJumpSfx() {
  playTone("triangle", 260, 520, 0.12, 0.05, 0.0001);
  playTone("sine", 480, 720, 0.08, 0.02, 0.0001);
}

function playHitSfx() {
  playTone("sawtooth", 210, 46, 0.22, 0.1, 0.0001);
  playTone("square", 980, 280, 0.16, 0.05, 0.0001);
  playNoise(0.18, 0.08, 0.0001, 180, 6800);
}

function playCrashSfx() {
  playTone("sawtooth", 160, 40, 0.38, 0.11, 0.0001);
  playNoise(0.26, 0.09, 0.0001, 120, 2600);
}

function playPowerupSfx() {
  const ctx = ensureAudio();
  if (!ctx || !audioState.sfxBus) return;

  const now = ctx.currentTime;
  const arp = [0, 4, 7, 12];
  for (let i = 0; i < arp.length; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.045;
    const note = 67 + arp[i];
    osc.type = i === arp.length - 1 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(midiToFreq(note), start);
    osc.frequency.exponentialRampToValueAtTime(midiToFreq(note + 7), start + 0.11);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(i === arp.length - 1 ? 0.08 : 0.055, start + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.21);
    osc.connect(gain);
    gain.connect(audioState.sfxBus);
    osc.start(start);
    osc.stop(start + 0.22);
  }

  // Bright confirmation ping on top.
  playTone("square", 1180, 1680, 0.14, 0.048, 0.0001);
  // Airy shimmer tail.
  playNoise(0.1, 0.035, 0.0001, 2400, 10800);
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function scheduleToneAt(type, time, freq, duration, gainAmount) {
  const ctx = ensureAudio();
  if (!ctx || !audioState.musicBus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(Math.max(0.0001, gainAmount), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(audioState.musicBus);
  osc.start(time);
  osc.stop(time + duration + 0.005);
}

function scheduleNoiseAt(time, duration, gainAmount, hp, lp) {
  const ctx = ensureAudio();
  const buffer = getNoiseBuffer(Math.max(0.06, duration));
  if (!ctx || !buffer || !audioState.musicBus) return;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = "highpass";
  hpFilter.frequency.value = hp;

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = "lowpass";
  lpFilter.frequency.value = lp;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, gainAmount), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  src.connect(hpFilter);
  hpFilter.connect(lpFilter);
  lpFilter.connect(gain);
  gain.connect(audioState.musicBus);
  src.start(time);
  src.stop(time + duration + 0.01);
}

function scheduleMusicStep(time, step) {
  const progression = [50, 57, 53, 55];
  const chordRoot = progression[Math.floor(step / 8) % progression.length];
  const leadPattern = [12, 7, 9, 7, 5, 4, 2, 4];
  const bassDur = 0.22;
  const leadDur = 0.13;

  if (step % 4 === 0) {
    scheduleToneAt("triangle", time, midiToFreq(chordRoot - 12), bassDur, 0.028);
    scheduleToneAt("sine", time, midiToFreq(chordRoot - 24), bassDur * 0.95, 0.015);
  }

  if (step % 2 === 0) {
    const lead = chordRoot + leadPattern[step % leadPattern.length];
    scheduleToneAt("square", time, midiToFreq(lead), leadDur, 0.018);
  }

  if (step % 2 === 1) {
    scheduleNoiseAt(time, 0.06, 0.008, 3200, 9200);
  }
}

function updateMusic() {
  const ctx = audioState.ctx;
  if (!ctx || ctx.state !== "running") return;
  if (!audioState.musicEnabled) return;

  const stepDuration = 60 / 112 / 4;
  if (!audioState.musicStarted) {
    audioState.musicStarted = true;
    audioState.musicStep = 0;
    audioState.musicNext = ctx.currentTime + 0.04;
  }

  while (audioState.musicNext < ctx.currentTime + 0.16) {
    scheduleMusicStep(audioState.musicNext, audioState.musicStep);
    audioState.musicNext += stepDuration;
    audioState.musicStep = (audioState.musicStep + 1) % 32;
  }
}

function setMusicEnabled(enabled) {
  audioState.musicEnabled = Boolean(enabled);
  if (audioState.musicBus) {
    const now = audioState.ctx ? audioState.ctx.currentTime : 0;
    const target = audioState.musicEnabled ? 0.12 : 0.0001;
    audioState.musicBus.gain.cancelScheduledValues(now);
    audioState.musicBus.gain.setTargetAtTime(target, now, 0.02);
  }
  if (musicToggleEl) {
    musicToggleEl.textContent = `Music: ${audioState.musicEnabled ? "On" : "Off"}`;
    musicToggleEl.setAttribute("aria-pressed", audioState.musicEnabled ? "true" : "false");
  }
}

function addCameraShake(amount) {
  state.cameraShake = clamp(state.cameraShake + amount, 0, SHAKE_CAP);
}

function createStar() {
  return {
    x: Math.random(),
    y: Math.random(),
    size: random(0.7, 2.4),
    twinkle: random(0, Math.PI * 2),
    speed: random(0.15, 1.1),
    alpha: random(0.3, 0.9),
    hue: random(196, 230),
    depth: random(0.2, 1),
  };
}

function seedVisuals() {
  state.stars = Array.from({ length: STAR_COUNT }, createStar);
}

function randomChoiceByWeight(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * total;
  for (const item of items) {
    pick -= item.weight;
    if (pick <= 0) return item;
  }
  return items[items.length - 1];
}

function frameRectFromIndex(index) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  return {
    sx: col * ATLAS_CELL,
    sy: row * ATLAS_CELL,
    sw: ATLAS_CELL,
    sh: ATLAS_CELL,
  };
}

function projectZ(z) {
  const norm = clamp(1 - z / WORLD_MAX_Z, 0, 1);
  const depth = Math.pow(norm, 1.7);
  return { norm, depth };
}

function laneCenterX(z) {
  const { depth } = projectZ(z);
  const topCenter = state.width * 0.52 + Math.sin(state.time * 0.15) * state.width * 0.012;
  const bottomCenter = state.width * 0.5 + Math.sin(state.time * 0.12) * state.width * 0.02;
  return lerp(topCenter, bottomCenter, depth);
}

function laneX(lane, z) {
  const { depth } = projectZ(z);
  const spanTop = state.width * 0.072;
  const spanBottom = state.width * 0.242;
  const span = lerp(spanTop, spanBottom, depth);
  return laneCenterX(z) + lane * span;
}

function laneY(z) {
  const { depth } = projectZ(z);
  const horizonY = state.height * 0.31;
  const groundY = state.height * 0.93;
  return lerp(horizonY, groundY, depth);
}

function playerScreenPosition() {
  const baseX = laneX(state.player.lane, PLAYER_Z);
  const baseY = laneY(PLAYER_Z);
  const jumpPixels = state.player.jumpY * (state.height * 0.018);
  return {
    x: baseX,
    y: baseY - jumpPixels,
    jumpPixels,
  };
}

function createSpark(x, y, intensity, hue = 205, saturation = 100, light = 74) {
  const life = random(0.2, 0.56);
  return {
    x,
    y,
    vx: random(-220, 130) * intensity,
    vy: random(-210, 60) * intensity,
    life,
    maxLife: life,
    size: random(2, 5),
    hue,
    saturation,
    light,
  };
}

function spawnBurst(x, y, count, intensity, hue = 205, saturation = 100, light = 74) {
  for (let i = 0; i < count; i += 1) {
    if (state.sparks.length >= SPARK_CAP) {
      state.sparks.shift();
    }
    state.sparks.push(createSpark(x, y, intensity, hue, saturation, light));
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

async function loadAssets() {
  try {
    const playerAtlas = await loadImage(`${ASSET_ROOT}/player/player_atlas.png`);
    state.assets.playerAtlas = playerAtlas;
    state.assets.ready = true;
    state.assets.error = null;
  } catch (error) {
    state.assets.ready = false;
    state.assets.error = error;
  }
}

function syncViewportMode() {
  state.isMobileViewport = MOBILE_QUERY.matches;
}

function resizeCanvas() {
  syncViewportMode();

  let width;
  let height;

  if (state.isMobileViewport) {
    const viewportW = Math.max(320, window.innerWidth);
    const viewportH = Math.max(560, window.innerHeight);
    const topChrome =
      (titlebarEl ? titlebarEl.offsetHeight : 0) +
      (mobileStatusShellEl ? mobileStatusShellEl.offsetHeight : 0) +
      (mobileControlsShellEl ? mobileControlsShellEl.offsetHeight : 0);
    const available = viewportH - topChrome - 10;

    width = viewportW;
    const minHeight = Math.round(width * 0.92);
    const maxHeight = Math.round(width * 1.55);
    height = clamp(Math.round(available), minHeight, maxHeight);
  } else {
    const maxWidth = Math.min(window.innerWidth - 24, 1100);
    width = clamp(maxWidth, 320, 1100);
    height = Math.round(width * 0.54);
  }

  state.width = width;
  state.height = height;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function resetGame() {
  state.phase = "ready";
  state.speed = BASE_SPEED;
  state.distance = 0;
  state.kills = 0;
  state.shipHealth = SHIP_HEALTH_MAX;
  state.missedAliens = 0;
  state.spawnTimer = 0;
  state.bonusTimer = 0;
  state.nextBonus = random(8, 14);
  state.nextSpawn = random(SPAWN_GAP_START_MIN, SPAWN_GAP_START_MAX);
  state.spawnGapFloor = SPAWN_GAP_FLOOR_START;
  state.cameraShake = 0;
  state.powerupFlash = 0;
  state.powerupFlashX = state.width * 0.5;
  state.powerupFlashY = state.height * 0.58;
  state.powerupHue = 132;
  state.obstacles = [];
  state.sparks = [];
  state.shots = [];
  state.fragments = [];
  state.blasts = [];
  state.bonuses = [];

  state.player.lane = 0;
  state.player.prevLane = 0;
  state.player.targetLane = 0;
  state.player.jumpY = 0;
  state.player.prevJumpY = 0;
  state.player.jumpVelocity = 0;
  state.player.shiftTimer = 0;
  state.player.shiftDir = 0;
  state.player.landTimer = 0;
  state.player.hitFlash = 0;
  state.player.runClock = 0;
  state.player.fireCooldown = 0;
  state.player.sprayTimer = 0;

  updateHud();
}

function startGame() {
  if (state.phase !== "ready") return;
  state.phase = "running";
}

function togglePause() {
  if (state.phase === "gameover" || state.phase === "ready") return;
  state.phase = state.phase === "paused" ? "running" : "paused";
  updateHud();
}

function moveLane(dir) {
  if (state.phase === "gameover" || state.phase === "paused") return;

  if (state.phase === "ready") {
    startGame();
  }

  const before = state.player.targetLane;
  state.player.targetLane = clamp(state.player.targetLane + dir, -1, 1);
  if (state.player.targetLane !== before) {
    state.player.shiftTimer = 0.18;
    state.player.shiftDir = dir;
  }
}

function jump() {
  if (state.phase === "gameover" || state.phase === "paused") return;

  if (state.phase === "ready") {
    startGame();
  }

  if (state.phase !== "running") return;
  if (state.player.jumpY > 0.02) return;

  state.player.jumpVelocity = physics.jumpVelocity;
  state.player.landTimer = 0;
  playJumpSfx();
  addCameraShake(0.08);

  const p = playerScreenPosition();
  spawnBurst(p.x - 18, p.y + 20, 11, 0.95);
}

function spawnAlienDestruction(obstacle) {
  const x = laneX(obstacle.lane, obstacle.z);
  const y = laneY(obstacle.z);
  const depth = projectZ(obstacle.z).depth;
  const radius = lerp(12, 58, depth) * getAlienScale(obstacle);

  state.blasts.push({
    x,
    y: y - radius * 0.58,
    life: 0.28,
    maxLife: 0.28,
    radius: radius * 1.1,
    hue: obstacle.emissiveHue || obstacle.primaryHue || 190,
  });
  state.blasts.push({
    x,
    y: y - radius * 0.58,
    life: 0.42,
    maxLife: 0.42,
    radius: radius * 1.9,
    hue: (obstacle.emissiveHue || obstacle.primaryHue || 190) + 18,
    shockwave: true,
  });
  if (state.blasts.length > BLAST_CAP) state.blasts.shift();

  const debrisCount = randomInt(12, 24);
  for (let i = 0; i < debrisCount; i += 1) {
    state.fragments.push({
      x,
      y: y - radius * 0.52,
      vx: random(-220, 220) * (0.4 + depth),
      vy: random(-240, -30) * (0.5 + depth * 0.6),
      gravity: random(280, 520),
      life: random(0.32, 0.8),
      maxLife: random(0.32, 0.8),
      size: random(2, 8) * (0.5 + depth * 0.8),
      spin: random(-8, 8),
      angle: random(0, Math.PI * 2),
      hue: (Math.random() < 0.55 ? obstacle.primaryHue : obstacle.secondaryHue) || 180,
      sat: random(72, 100),
      light: random(42, 74),
    });
  }
  while (state.fragments.length > FRAGMENT_CAP) state.fragments.shift();

  spawnBurst(
    x,
    y - radius * 0.42,
    24,
    1.18,
    obstacle.emissiveHue || 185,
    100,
    74
  );
  addCameraShake(0.24 + depth * 0.32);
  playHitSfx();
}

function shoot() {
  if (state.phase === "gameover" || state.phase === "paused") return;

  if (state.phase === "ready") {
    startGame();
  }

  if (state.phase !== "running") return;
  if (state.player.fireCooldown > 0) return;

  const sprayActive = state.player.sprayTimer > 0;
  const offsets = sprayActive ? [-0.62, -0.34, 0, 0.34, 0.62] : [0];
  for (const offset of offsets) {
    const shotLane = clamp(state.player.lane + offset, -1.35, 1.35);
    const shot = {
      spray: sprayActive,
      lane: shotLane,
      z: PLAYER_Z + 0.8,
      speed: sprayActive ? random(88, 114) : random(94, 122),
      life: sprayActive ? 1.08 : 1.28,
      hue: sprayActive ? random(140, 230) : random(176, 216),
      size: sprayActive ? random(0.78, 1.08) : random(0.85, 1.2),
    };
    state.shots.push(shot);
  }
  while (state.shots.length > SHOT_CAP) state.shots.shift();
  state.player.fireCooldown = sprayActive ? 0.095 : 0.15;
  addCameraShake(0.045);
  playShootSfx();

  const p = playerScreenPosition();
  spawnBurst(p.x, p.y - 26, 8, 0.62, shot.hue, 100, 78);
  state.blasts.push({
    x: p.x,
    y: p.y - 24,
    life: 0.12,
    maxLife: 0.12,
    radius: state.height * (sprayActive ? 0.06 : 0.045),
    hue: sprayActive ? 150 : 196,
    muzzle: true,
  });
  if (state.blasts.length > BLAST_CAP) state.blasts.shift();
}

function spawnBonusObject() {
  const spawnZ = WORLD_MAX_Z + random(8, 20);
  const hue = random(110, 160);
  state.bonuses.push({
    lane: randomChoiceByWeight([
      { lane: -1, weight: 1 },
      { lane: 0, weight: 1.15 },
      { lane: 1, weight: 1 },
    ]).lane,
    z: spawnZ,
    prevZ: spawnZ,
    life: random(7.5, 12.5),
    pulse: random(0, Math.PI * 2),
    hue,
    spin: random(-1.8, 1.8),
  });
  while (state.bonuses.length > BONUS_CAP) state.bonuses.shift();
}

function spawnObstacleGroup() {
  const patternRoll = Math.random();
  let lanes;

  if (patternRoll < 0.44) {
    lanes = [Math.floor(random(-1, 2))];
  } else if (patternRoll < 0.86) {
    lanes = Math.random() < 0.5 ? [-1, 0] : [0, 1];
  } else {
    lanes = [-1, 1];
  }

  const zJitter = random(0, 8);
  const spawnAlienAtLane = (lane, spawnZ) => {
    const spec = randomChoiceByWeight(ALIEN_ARCHETYPES);
    const primaryHue = random(8, 338);
    const secondaryHue = (primaryHue + random(22, 108)) % 360;
    const emissiveHue = (secondaryHue + random(38, 150)) % 360;

    const scale = random(spec.scale[0], spec.scale[1]);
    state.obstacles.push({
      lane,
      z: spawnZ,
      prevZ: spawnZ,
      type: spec.type,
      jumpClear: spec.jumpClear + random(-0.14, 0.16),
      yOffset: spec.yOffset + random(-0.025, 0.03),
      scale,
      hover: spec.hover,
      bobSpeed: random(1.4, 4.4),
      bobAmp: random(0.018, 0.08),
      animSeed: random(0, Math.PI * 2),
      primaryHue,
      secondaryHue,
      emissiveHue,
      eyeCount: randomInt(1, 4),
      plateCount: randomInt(3, 7),
      spineCount: randomInt(3, 9),
      tentacleCount: randomInt(2, 8),
      limbCount: randomInt(2, 6),
      scarCount: randomInt(0, 4),
      jawOpen: random(0.2, 1),
      pulseSpeed: random(1.1, 3.8),
      roughness: random(0.18, 0.58),
    });
  };

  const baseSpawnZ = WORLD_MAX_Z + zJitter;
  for (const lane of lanes) {
    spawnAlienAtLane(lane, baseSpawnZ);
  }

  if (state.distance >= STACKED_UNLOCK_DISTANCE && lanes.length > 0) {
    const unlockT = clamp((state.distance - STACKED_UNLOCK_DISTANCE) / 1800, 0, 1);
    const stackChance = lerp(STACKED_BASE_CHANCE, STACKED_MAX_CHANCE, unlockT);
    if (Math.random() < stackChance) {
      const stackLane = lanes[randomInt(0, lanes.length - 1)];
      const stackedSpawnZ = baseSpawnZ + random(STACKED_Z_OFFSET_MIN, STACKED_Z_OFFSET_MAX);
      spawnAlienAtLane(stackLane, stackedSpawnZ);
    }
  }
}

function crash() {
  if (state.phase === "gameover") return;
  state.phase = "gameover";
  state.player.hitFlash = 1;
  addCameraShake(0.68);
  playCrashSfx();

  const p = playerScreenPosition();
  spawnBurst(p.x, p.y, 24, 1.22);

  state.bestKills = Math.max(state.bestKills, state.kills);
  saveBestScore(state.bestKills);
}

function registerMissedAlien() {
  if (state.phase !== "running") return;
  state.missedAliens += 1;
  const healthStep = SHIP_HEALTH_MAX / MISSES_TO_DESTROY;
  state.shipHealth = clamp(SHIP_HEALTH_MAX - state.missedAliens * healthStep, 0, SHIP_HEALTH_MAX);

  if (state.shipHealth <= 0) {
    const p = playerScreenPosition();
    for (let i = 0; i < 3; i += 1) {
      state.blasts.push({
        x: p.x + random(-state.height * 0.08, state.height * 0.08),
        y: p.y - random(state.height * 0.04, state.height * 0.18),
        life: 0.45,
        maxLife: 0.45,
        radius: state.height * random(0.1, 0.16),
        hue: random(8, 36),
        shockwave: true,
      });
      spawnBurst(
        p.x + random(-state.height * 0.06, state.height * 0.06),
        p.y - random(10, state.height * 0.16),
        18,
        1.35,
        random(8, 32),
        100,
        62
      );
    }
    crash();
  }
}

function updatePlayer(dt) {
  state.player.prevLane = state.player.lane;
  state.player.prevJumpY = state.player.jumpY;
  const previousJumpY = state.player.jumpY;

  const laneDelta = state.player.targetLane - state.player.lane;
  state.player.lane += laneDelta * Math.min(1, dt * 12);

  state.player.jumpVelocity -= physics.gravity * dt;
  state.player.jumpY += state.player.jumpVelocity * dt;

  if (state.player.jumpY <= 0) {
    if (previousJumpY > 0.14 && state.phase === "running") {
      const p = playerScreenPosition();
      spawnBurst(p.x - 8, p.y + 28, 6, 0.62);
      state.player.landTimer = 0.14;
    }
    state.player.jumpY = 0;
    state.player.jumpVelocity = 0;
  }

  state.player.shiftTimer = Math.max(0, state.player.shiftTimer - dt);
  if (state.player.shiftTimer === 0) {
    state.player.shiftDir = 0;
  }

  state.player.landTimer = Math.max(0, state.player.landTimer - dt);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - dt * 2.2);
  state.player.fireCooldown = Math.max(0, state.player.fireCooldown - dt);
  state.player.sprayTimer = Math.max(0, state.player.sprayTimer - dt);
  state.player.runClock += dt * state.speed * 0.42;
}

function updateSparks(dt) {
  for (let i = state.sparks.length - 1; i >= 0; i -= 1) {
    const spark = state.sparks[i];
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += 420 * dt;
    spark.vx *= 0.985;

    if (spark.life <= 0) {
      state.sparks.splice(i, 1);
    }
  }
}

function updateFragments(dt) {
  for (let i = state.fragments.length - 1; i >= 0; i -= 1) {
    const frag = state.fragments[i];
    frag.life -= dt;
    frag.x += frag.vx * dt;
    frag.y += frag.vy * dt;
    frag.vy += frag.gravity * dt;
    frag.vx *= 0.985;
    frag.angle += frag.spin * dt;

    if (frag.life <= 0) {
      state.fragments.splice(i, 1);
    }
  }
}

function updateBlasts(dt) {
  for (let i = state.blasts.length - 1; i >= 0; i -= 1) {
    const blast = state.blasts[i];
    blast.life -= dt;
    if (blast.life <= 0) state.blasts.splice(i, 1);
  }
}

function updateShots(dt) {
  for (let i = state.shots.length - 1; i >= 0; i -= 1) {
    const shot = state.shots[i];
    shot.life -= dt;
    shot.z += shot.speed * dt;

    if (shot.life <= 0 || shot.z > WORLD_MAX_Z + 12) {
      state.shots.splice(i, 1);
      continue;
    }

    let hitIndex = -1;
    for (let j = state.obstacles.length - 1; j >= 0; j -= 1) {
      const obstacle = state.obstacles[j];
      const sprayLaneBoost = shot.spray ? (state.isMobileViewport ? 0.12 : 0.08) : 0;
      const sprayZBoost = shot.spray ? (state.isMobileViewport ? 0.34 : 0.22) : 0;
      const laneTolerance = 0.45 + sprayLaneBoost;
      const zTolerance = 2.4 + sprayZBoost;
      const laneHit = Math.abs(obstacle.lane - shot.lane) < laneTolerance;
      const zHit = Math.abs(obstacle.z - shot.z) < zTolerance;
      if (laneHit && zHit) {
        hitIndex = j;
        break;
      }
    }

    if (hitIndex >= 0) {
      const obstacle = state.obstacles[hitIndex];
      state.obstacles.splice(hitIndex, 1);
      state.shots.splice(i, 1);
      state.kills += 1;
      spawnAlienDestruction(obstacle);
    }
  }
}

function updateBonuses(dt) {
  // Bonus pickup is intentionally a bit forgiving so side catches still count.
  const zForgiveness = state.isMobileViewport ? 0.34 : 0.24;
  const bandMin = PLAYER_Z - (1.45 + zForgiveness);
  const bandMax = PLAYER_Z + (1.5 + zForgiveness);
  const laneShift = Math.abs(state.player.targetLane - state.player.lane);
  const laneForgiveness = (state.isMobileViewport ? 0.2 : 0.12) + laneShift * 0.14;
  const playerLaneMin = Math.min(state.player.prevLane, state.player.lane) - (0.2 + laneForgiveness);
  const playerLaneMax = Math.max(state.player.prevLane, state.player.lane) + (0.2 + laneForgiveness);

  for (let i = state.bonuses.length - 1; i >= 0; i -= 1) {
    const bonus = state.bonuses[i];
    const prevZ = bonus.prevZ ?? bonus.z;
    bonus.prevZ = bonus.z;
    bonus.life -= dt;
    bonus.z -= state.speed * dt;

    if (bonus.life <= 0 || bonus.z < -8) {
      state.bonuses.splice(i, 1);
      continue;
    }

    if (state.phase !== "running") continue;

    const zSweepMin = Math.min(prevZ, bonus.z);
    const zSweepMax = Math.max(prevZ, bonus.z);
    const overlapsZ = zSweepMax >= bandMin && zSweepMin <= bandMax;
    if (!overlapsZ) continue;

    const bonusHalfWidth = state.isMobileViewport ? 0.38 : 0.32;
    const bonusLaneMin = bonus.lane - bonusHalfWidth;
    const bonusLaneMax = bonus.lane + bonusHalfWidth;
    const laneMatch = playerLaneMax >= bonusLaneMin && playerLaneMin <= bonusLaneMax;
    if (!laneMatch) continue;

    state.bonuses.splice(i, 1);
    state.player.sprayTimer = Math.max(state.player.sprayTimer, 6.5);
    playPowerupSfx();
    addCameraShake(0.24);

    const x = laneX(bonus.lane, bonus.z);
    const y = laneY(bonus.z);
    const hue = bonus.hue || 132;
    state.powerupFlash = Math.max(state.powerupFlash, 1);
    state.powerupFlashX = x;
    state.powerupFlashY = y - state.height * 0.08;
    state.powerupHue = hue;

    state.blasts.push({
      x,
      y: y - state.height * 0.07,
      life: 0.46,
      maxLife: 0.46,
      radius: state.height * 0.15,
      hue,
      shockwave: true,
    });
    state.blasts.push({
      x,
      y: y - state.height * 0.07,
      life: 0.24,
      maxLife: 0.24,
      radius: state.height * 0.09,
      hue: (hue + 22) % 360,
    });
    spawnBurst(x, y - state.height * 0.06, 34, 1.36, hue, 100, 74);
    spawnBurst(x, y - state.height * 0.05, 18, 1.1, (hue + 34) % 360, 96, 80);
  }
}

function updateObstacles(dt) {
  const bandMin = PLAYER_Z - 1.45;
  const bandMax = PLAYER_Z + 1.5;
  const playerLaneMin = Math.min(state.player.prevLane, state.player.lane) - 0.22;
  const playerLaneMax = Math.max(state.player.prevLane, state.player.lane) + 0.22;
  const peakJump = Math.max(state.player.prevJumpY, state.player.jumpY);

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = state.obstacles[i];
    const prevZ = obstacle.prevZ ?? obstacle.z;
    obstacle.prevZ = obstacle.z;
    obstacle.z -= state.speed * dt;

    if (obstacle.z < -6) {
      state.obstacles.splice(i, 1);
      registerMissedAlien();
      if (state.phase === "gameover") return;
      continue;
    }

    if (state.phase !== "running") continue;

    const zSweepMin = Math.min(prevZ, obstacle.z);
    const zSweepMax = Math.max(prevZ, obstacle.z);
    const overlapsZ = zSweepMax >= bandMin && zSweepMin <= bandMax;
    if (!overlapsZ) continue;

    const obstacleHalfWidth = 0.26 + getAlienScale(obstacle) * 0.16;
    const obstacleLaneMin = obstacle.lane - obstacleHalfWidth;
    const obstacleLaneMax = obstacle.lane + obstacleHalfWidth;
    const laneOverlap = playerLaneMax >= obstacleLaneMin && playerLaneMin <= obstacleLaneMax;
    const safeJump = peakJump > obstacle.jumpClear;

    if (laneOverlap && !safeJump) {
      crash();
      return;
    }
  }
}

function step(dt) {
  if (state.phase === "paused") {
    updateHud();
    return;
  }

  state.time += dt;
  state.cameraShake = Math.max(0, state.cameraShake - dt * 2.6);
  state.powerupFlash = Math.max(0, state.powerupFlash - dt * 2.9);
  updateMusic();

  updatePlayer(dt);

  if (state.phase === "running") {
    const speedProgress = clamp((state.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
    const accel = lerp(SPEED_ACCEL_START, SPEED_ACCEL_END, speedProgress);
    state.speed = Math.min(MAX_SPEED, state.speed + dt * accel);
    state.distance += dt * state.speed * 1.22;

    state.spawnTimer += dt;
    if (state.spawnTimer >= state.nextSpawn) {
      state.spawnTimer = 0;
      state.nextSpawn = random(state.spawnGapFloor, state.spawnGapFloor + SPAWN_GAP_VARIANCE);
      state.spawnGapFloor = Math.max(SPAWN_GAP_FLOOR_MIN, state.spawnGapFloor - SPAWN_GAP_DECAY);
      spawnObstacleGroup();
    }

    state.bonusTimer += dt;
    if (state.bonusTimer >= state.nextBonus) {
      state.bonusTimer = 0;
      state.nextBonus = random(9, 15.5);
      spawnBonusObject();
    }

    if (Math.random() < dt * 23) {
      const p = playerScreenPosition();
      spawnBurst(
        p.x - 24,
        p.y + 16,
        1,
        clamp((state.speed - 30) / 36, 0.25, 0.66)
      );
    }
  }

  updateObstacles(dt);
  updateBonuses(dt);
  updateShots(dt);
  updateSparks(dt);
  updateFragments(dt);
  updateBlasts(dt);
  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#02040d");
  sky.addColorStop(0.45, "#060d21");
  sky.addColorStop(1, "#0a1634");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  const dustClouds = [
    { x: 0.16, y: 0.2, r: 0.36, color: "rgba(82, 58, 130, 0.16)" },
    { x: 0.82, y: 0.23, r: 0.34, color: "rgba(41, 109, 176, 0.16)" },
    { x: 0.56, y: 0.58, r: 0.43, color: "rgba(29, 80, 133, 0.12)" },
  ];

  for (const cloud of dustClouds) {
    const rg = ctx.createRadialGradient(
      state.width * cloud.x,
      state.height * cloud.y,
      2,
      state.width * cloud.x,
      state.height * cloud.y,
      state.width * cloud.r
    );
    rg.addColorStop(0, cloud.color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  const laneShift = state.player.lane * 0.0016;
  for (const star of state.stars) {
    const drift = state.time * star.speed * (0.8 + star.depth * 0.8);
    const x = ((((star.x + drift * 0.003 + laneShift * star.depth) % 1) + 1) % 1) * state.width;
    const y = star.y * state.height;
    const twinkle = 0.5 + Math.sin(state.time * 2.1 + star.twinkle) * 0.5;
    const alpha = star.alpha * (0.5 + twinkle * 0.5);
    const size = Math.max(1, Math.round(star.size * (0.75 + star.depth * 0.9) + twinkle * 0.4));
    ctx.fillStyle = `hsla(${star.hue} 95% 92% / ${alpha.toFixed(3)})`;
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }

  const milkyWay = ctx.createLinearGradient(
    state.width * 0.12,
    0,
    state.width * 0.86,
    state.height
  );
  milkyWay.addColorStop(0, "rgba(148, 188, 255, 0)");
  milkyWay.addColorStop(0.5, "rgba(156, 207, 255, 0.09)");
  milkyWay.addColorStop(1, "rgba(148, 188, 255, 0)");
  ctx.fillStyle = milkyWay;
  ctx.fillRect(0, 0, state.width, state.height);

  const vignette = ctx.createRadialGradient(
    state.width * 0.5,
    state.height * 0.5,
    state.height * 0.28,
    state.width * 0.5,
    state.height * 0.5,
    state.height * 0.92
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, state.width, state.height);
}

function drawRunway() {
  const horizonY = state.height * 0.31;
  const nearY = state.height * 0.95;

  const roadTopLeft = laneX(-1.46, WORLD_MAX_Z);
  const roadTopRight = laneX(1.46, WORLD_MAX_Z);
  const roadBottomLeft = laneX(-1.56, 0);
  const roadBottomRight = laneX(1.56, 0);

  const roadGrad = ctx.createLinearGradient(0, horizonY, 0, nearY);
  roadGrad.addColorStop(0, "rgba(20,42,70,0.78)");
  roadGrad.addColorStop(0.45, "rgba(22,54,84,0.62)");
  roadGrad.addColorStop(1, "rgba(12,25,40,0.94)");

  ctx.fillStyle = roadGrad;
  ctx.beginPath();
  ctx.moveTo(roadTopLeft, horizonY);
  ctx.lineTo(roadTopRight, horizonY);
  ctx.lineTo(roadBottomRight, nearY);
  ctx.lineTo(roadBottomLeft, nearY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(140,232,255,0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(roadBottomLeft, nearY);
  ctx.lineTo(roadTopLeft, horizonY);
  ctx.lineTo(roadTopRight, horizonY);
  ctx.lineTo(roadBottomRight, nearY);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(roadTopLeft, horizonY);
  ctx.lineTo(roadTopRight, horizonY);
  ctx.lineTo(roadBottomRight, nearY);
  ctx.lineTo(roadBottomLeft, nearY);
  ctx.closePath();
  ctx.clip();

  for (let z = 0; z <= WORLD_MAX_Z; z += 9) {
    const y = laneY(z);
    const left = laneX(-1.56, z);
    const right = laneX(1.56, z);
    const depth = projectZ(z).depth;
    ctx.strokeStyle = `rgba(108,214,255,${0.06 + depth * 0.25})`;
    ctx.lineWidth = 1 + depth * 1.8;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  const dashOffset = (state.time * state.speed * 4.6) % 18;
  for (let z = dashOffset; z <= WORLD_MAX_Z; z += 18) {
    const z2 = z + 9;
    if (z2 > WORLD_MAX_Z) continue;

    const y1 = laneY(z);
    const y2 = laneY(z2);
    const x1 = laneX(0, z);
    const x2 = laneX(0, z2);
    const depth = projectZ(z).depth;

    ctx.strokeStyle = `rgba(255,222,118,${0.22 + depth * 0.5})`;
    ctx.lineWidth = 2 + depth * 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

function obstacleMetrics(obstacle) {
  const x = laneX(obstacle.lane, obstacle.z);
  const y = laneY(obstacle.z);
  const depth = projectZ(obstacle.z).depth;
  return { x, y, depth };
}

function getAlienScale(obstacle) {
  const baseScale = obstacle.scale || 1;
  return state.isMobileViewport ? baseScale * 0.78 : baseScale;
}

function hsla(h, s, l, a) {
  return `hsla(${Math.round(h)} ${s}% ${l}% / ${a})`;
}

function fillRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawEyeCluster(obstacle, radius, depth) {
  const count = Math.max(1, obstacle.eyeCount || 1);
  const spread = radius * (count <= 2 ? 0.36 : 0.56);
  const glowHue = obstacle.emissiveHue || 180;
  const pulse = 0.65 + 0.35 * Math.sin(state.time * (obstacle.pulseSpeed || 2) + obstacle.animSeed);

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const ex = t * spread + Math.sin(state.time * 2.2 + obstacle.animSeed + i) * radius * 0.03;
    const ey = -radius * 0.16 + Math.cos(state.time * 1.7 + obstacle.animSeed + i * 0.7) * radius * 0.02;
    const er = radius * (count === 1 ? 0.18 : 0.11) * (0.86 + depth * 0.28);

    const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 2.8);
    glow.addColorStop(0, hsla(glowHue, 100, 74, 0.78 * pulse));
    glow.addColorStop(1, hsla(glowHue, 100, 60, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, er * 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(238,248,255,0.96)";
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * (0.84 + pulse * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hsla(glowHue, 100, 62, 0.94);
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(6,9,14,0.88)";
    ctx.beginPath();
    ctx.arc(ex + er * 0.12, ey + er * 0.08, er * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAlienObstacle(obstacle, x, y, depth) {
  const radius = lerp(18, 82, depth) * getAlienScale(obstacle);
  const motionT = state.time * (obstacle.bobSpeed || 2.6) + (obstacle.animSeed || 0);
  const sway = Math.sin(motionT * 0.9) * radius * 0.12;
  const bob = Math.sin(motionT) * state.height * (obstacle.bobAmp || 0.04) * (0.32 + depth);
  const hoverLift = obstacle.hover ? radius * (0.16 + 0.05 * Math.sin(motionT * 1.4)) : 0;
  const yOffset = (obstacle.yOffset || 0) * state.height * 0.05;
  const cx = x + sway;
  const cy = y - radius * 0.95 - yOffset - bob - hoverLift;
  const rough = obstacle.roughness || 0.36;
  const primaryHue = obstacle.primaryHue || 190;
  const secondaryHue = obstacle.secondaryHue || 235;
  const emissiveHue = obstacle.emissiveHue || 180;
  const bodyGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.45, radius * 0.12, cx, cy, radius * 1.2);
  bodyGrad.addColorStop(0, hsla(primaryHue, 92, 72, 0.98));
  bodyGrad.addColorStop(0.58, hsla(primaryHue, 84, 52, 0.98));
  bodyGrad.addColorStop(1, hsla(secondaryHue, 72, 26, 0.98));
  const bellyGrad = ctx.createLinearGradient(cx, cy - radius * 0.2, cx, cy + radius * 0.95);
  bellyGrad.addColorStop(0, hsla(secondaryHue, 62, 28, 0.28));
  bellyGrad.addColorStop(1, hsla(secondaryHue, 58, 10, 0.7));

  ctx.save();
  ctx.globalAlpha = 0.99;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "rgba(3, 8, 14, 0.45)";
  ctx.beginPath();
  ctx.ellipse(
    x,
    y + 4,
    radius * (0.45 + depth * 0.4),
    radius * (obstacle.hover ? 0.09 : 0.12),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.45);
  glow.addColorStop(0, hsla(emissiveHue, 100, 70, 0.28));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.42, radius * 1.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(motionT * 0.7) * 0.05);

  if (obstacle.type === "sentinel") {
    ctx.fillStyle = bodyGrad;
    fillRoundedRect(-radius * 0.48, -radius * 0.64, radius * 0.96, radius * 1.28, radius * 0.18);
    ctx.fillStyle = hsla(primaryHue + 10, 76, 30, 0.94);
    fillRoundedRect(-radius * 0.38, -radius * 0.2, radius * 0.76, radius * 0.52, radius * 0.11);
    for (let i = 0; i < obstacle.plateCount; i += 1) {
      const t = i / Math.max(1, obstacle.plateCount - 1) - 0.5;
      ctx.fillStyle = hsla(secondaryHue + t * 20, 72, 44, 0.68);
      fillRoundedRect(t * radius * 0.74 - radius * 0.07, radius * 0.2, radius * 0.14, radius * 0.34, radius * 0.05);
    }
  } else if (obstacle.type === "behemoth") {
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.1, radius * 0.74, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hsla(primaryHue - 10, 80, 38, 0.96);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.24, radius * 0.54, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < obstacle.spineCount; i += 1) {
      const t = i / Math.max(1, obstacle.spineCount - 1) - 0.5;
      const sx = t * radius * 1.16;
      const sy = -radius * (0.5 + 0.06 * Math.sin(i + obstacle.animSeed));
      ctx.fillStyle = hsla(secondaryHue + i * 4, 82, 56, 0.9);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + radius * 0.08, sy + radius * 0.34);
      ctx.lineTo(sx - radius * 0.08, sy + radius * 0.34);
      ctx.closePath();
      ctx.fill();
    }
  } else if (obstacle.type === "cephalid") {
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.12, radius * 0.56, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    const tentacles = Math.max(2, obstacle.tentacleCount || 5);
    for (let i = 0; i < tentacles; i += 1) {
      const t = tentacles === 1 ? 0 : i / (tentacles - 1) - 0.5;
      const tx = t * radius * 0.9;
      const sway2 = Math.sin(motionT * 1.7 + i * 0.7) * radius * 0.16;
      ctx.strokeStyle = hsla(primaryHue + i * 7, 88, 56, 0.9);
      ctx.lineWidth = Math.max(1.2, radius * 0.085);
      ctx.beginPath();
      ctx.moveTo(tx, radius * 0.1);
      ctx.quadraticCurveTo(tx + sway2, radius * 0.62, tx - sway2 * 0.55, radius * 0.98);
      ctx.stroke();
    }
  } else if (obstacle.type === "stalker") {
    ctx.fillStyle = bodyGrad;
    fillRoundedRect(-radius * 0.32, -radius * 0.7, radius * 0.64, radius * 1.1, radius * 0.2);
    const limbs = Math.max(2, obstacle.limbCount || 4);
    for (let i = 0; i < limbs; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const y0 = -radius * 0.08 + row * radius * 0.2;
      const stride = Math.sin(motionT * 1.4 + i) * radius * 0.08;
      ctx.strokeStyle = hsla(secondaryHue + i * 4, 76, 54, 0.95);
      ctx.lineWidth = Math.max(1.1, radius * 0.065);
      ctx.beginPath();
      ctx.moveTo(side * radius * 0.24, y0);
      ctx.lineTo(side * radius * 0.66 + stride, y0 + radius * 0.26);
      ctx.stroke();
    }
  } else if (obstacle.type === "leviathan") {
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.82);
    ctx.lineTo(radius * 0.62, -radius * 0.08);
    ctx.lineTo(radius * 0.18, radius * 0.86);
    ctx.lineTo(-radius * 0.18, radius * 0.86);
    ctx.lineTo(-radius * 0.62, -radius * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hsla(secondaryHue + 22, 88, 64, 0.86);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.1, radius * 0.22, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.03, radius * 0.6, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < obstacle.spineCount; i += 1) {
      const t = i / Math.max(1, obstacle.spineCount - 1) - 0.5;
      const sx = t * radius * 1.02;
      const h = radius * (0.36 + 0.28 * Math.abs(Math.sin(obstacle.animSeed + i * 1.6)));
      ctx.fillStyle = hsla(secondaryHue + i * 5, 86, 58, 0.92);
      ctx.beginPath();
      ctx.moveTo(sx, -radius * 0.2 - h);
      ctx.lineTo(sx + radius * 0.08, radius * 0.2);
      ctx.lineTo(sx - radius * 0.08, radius * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.34, radius * 0.5, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  drawEyeCluster(obstacle, radius, depth);

  if ((obstacle.scarCount || 0) > 0) {
    for (let i = 0; i < obstacle.scarCount; i += 1) {
      const a = obstacle.animSeed + i * 1.8;
      const x0 = Math.sin(a) * radius * 0.35;
      const y0 = Math.cos(a * 1.2) * radius * 0.28;
      ctx.strokeStyle = hsla(primaryHue + 30, 35, 80, 0.3 + rough * 0.4);
      ctx.lineWidth = Math.max(1, radius * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0 - radius * 0.08, y0 - radius * 0.04);
      ctx.lineTo(x0 + radius * 0.1, y0 + radius * 0.05);
      ctx.stroke();
    }
  }

  if (obstacle.jawOpen > 0.35) {
    const jaw = radius * (0.14 + obstacle.jawOpen * 0.1);
    ctx.fillStyle = hsla(secondaryHue - 10, 62, 10, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.3, jaw, jaw * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hsla(emissiveHue + 16, 85, 62, 0.82);
    for (let i = 0; i < 3; i += 1) {
      const tx = (i - 1) * jaw * 0.45;
      ctx.beginPath();
      ctx.moveTo(tx, radius * 0.16);
      ctx.lineTo(tx + jaw * 0.12, radius * 0.31);
      ctx.lineTo(tx - jaw * 0.12, radius * 0.31);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = "screen";
  const rim = ctx.createLinearGradient(0, -radius * 0.85, 0, radius * 0.95);
  rim.addColorStop(0, hsla(primaryHue + 35, 95, 80, 0.26));
  rim.addColorStop(0.45, "rgba(255,255,255,0)");
  rim.addColorStop(1, hsla(emissiveHue, 95, 66, 0.12));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.08, radius * 0.98, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

function drawObstacles() {
  const sorted = [...state.obstacles].sort((a, b) => b.z - a.z);
  for (const obstacle of sorted) {
    if (obstacle.z < -2 || obstacle.z > WORLD_MAX_Z + 14) continue;
    const { x, y, depth } = obstacleMetrics(obstacle);
    drawAlienObstacle(obstacle, x, y, depth);
  }
}

function getPlayerFrameIndex() {
  if (state.phase === "gameover") {
    const hitT = clamp(1 - state.player.hitFlash, 0, 0.999);
    const idx = Math.floor(hitT * PLAYER_ANIMS.hit.length);
    return PLAYER_ANIMS.hit[Math.min(PLAYER_ANIMS.hit.length - 1, idx)];
  }

  if (state.player.landTimer > 0.02) {
    const t = 1 - state.player.landTimer / 0.14;
    const idx = Math.floor(clamp(t, 0, 0.999) * PLAYER_ANIMS.land.length);
    return PLAYER_ANIMS.land[Math.min(PLAYER_ANIMS.land.length - 1, idx)];
  }

  if (state.player.jumpY > 0.08) {
    if (state.player.jumpVelocity > 3) return PLAYER_ANIMS.jump_up[1];
    if (state.player.jumpVelocity > -3) return PLAYER_ANIMS.jump_up[2];
    return PLAYER_ANIMS.fall[0];
  }

  if (state.player.shiftTimer > 0 && state.player.shiftDir !== 0) {
    const frames = state.player.shiftDir < 0 ? PLAYER_ANIMS.shift_left : PLAYER_ANIMS.shift_right;
    const t = 1 - state.player.shiftTimer / 0.18;
    const idx = Math.floor(clamp(t, 0, 0.999) * frames.length);
    return frames[Math.min(frames.length - 1, idx)];
  }

  if (state.phase === "ready") {
    return PLAYER_ANIMS.idle[0];
  }

  const runIdx = Math.floor(state.player.runClock) % PLAYER_ANIMS.run.length;
  return PLAYER_ANIMS.run[runIdx];
}

function drawPlayer() {
  const pos = playerScreenPosition();

  ctx.save();

  const shadowStretch = clamp(1 - pos.jumpPixels / (state.height * 0.3), 0.45, 1);
  ctx.fillStyle = "rgba(2, 12, 22, 0.48)";
  ctx.beginPath();
  ctx.ellipse(
    pos.x,
    pos.y + state.height * 0.03 + pos.jumpPixels * 0.38,
    state.height * 0.05 * shadowStretch,
    state.height * 0.016 * shadowStretch,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (!state.assets.ready || !state.assets.playerAtlas) {
    ctx.fillStyle = "#9cecff";
    ctx.fillRect(pos.x - 12, pos.y - 44, 24, 44);
    ctx.restore();
    return;
  }

  const frameIndex = getPlayerFrameIndex();
  const frame = frameRectFromIndex(frameIndex);

  const baseScale = clamp(state.height / 660, 0.8, 1.2);
  const squash = state.player.jumpY > 0.08 ? 1.03 : 1;
  const drawW = frame.sw * baseScale * 0.72 * squash;
  const drawH = frame.sh * baseScale * 0.72 / squash;

  const tilt = (state.player.targetLane - state.player.lane) * 0.12;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(tilt);

  const dx = -drawW * 0.5;
  const dy = -drawH * 0.84;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    state.assets.playerAtlas,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    Math.round(dx),
    Math.round(dy),
    Math.round(drawW),
    Math.round(drawH)
  );

  if (state.player.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 125, 142, ${state.player.hitFlash * 0.32})`;
    ctx.fillRect(Math.round(dx), Math.round(dy), Math.round(drawW), Math.round(drawH));
  }

  ctx.restore();
}

function drawSparks() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const spark of state.sparks) {
    const t = spark.life / spark.maxLife;
    const size = spark.size * (0.4 + t * 0.8);
    const hue = (spark.hue || 180) + t * 12;
    const sat = spark.saturation || 100;
    const light = spark.light || 74;
    ctx.fillStyle = `hsla(${hue} ${sat}% ${light}% / ${t * 0.85})`;
    ctx.fillRect(Math.round(spark.x), Math.round(spark.y), Math.round(size), Math.round(size));
  }
  ctx.restore();
}

function drawShots() {
  for (const shot of state.shots) {
    const x = laneX(shot.lane, shot.z);
    const y = laneY(shot.z);
    const depth = projectZ(shot.z).depth;
    const len = lerp(10, 28, depth) * shot.size;
    const wid = lerp(2, 6, depth) * shot.size;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // plasma trail
    for (let i = 1; i <= 4; i += 1) {
      const tz = shot.z - i * 2.4;
      if (tz < 0) continue;
      const tx = laneX(shot.lane, tz);
      const ty = laneY(tz);
      const td = projectZ(tz).depth;
      const tw = lerp(1.2, 4.8, td) * shot.size;
      ctx.fillStyle = hsla(shot.hue + i * 5, 100, 68, 0.16 + (0.16 * (5 - i)) / 5);
      ctx.beginPath();
      ctx.ellipse(tx, ty - len * 0.2, tw * 1.8, tw, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const core = ctx.createLinearGradient(x, y + len * 0.2, x, y - len);
    core.addColorStop(0, hsla(shot.hue, 100, 52, 0.0));
    core.addColorStop(0.4, hsla(shot.hue, 100, 70, 0.85));
    core.addColorStop(1, hsla(shot.hue + 24, 100, 80, 0.95));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(x, y - len);
    ctx.lineTo(x + wid, y + len * 0.2);
    ctx.lineTo(x - wid, y + len * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(236,248,255,0.9)";
    ctx.beginPath();
    ctx.arc(x, y - len * 0.65, wid * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // cross flare
    ctx.strokeStyle = hsla(shot.hue + 20, 100, 78, 0.55);
    ctx.lineWidth = Math.max(1, wid * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - wid * 1.6, y - len * 0.64);
    ctx.lineTo(x + wid * 1.6, y - len * 0.64);
    ctx.moveTo(x, y - len * 0.82);
    ctx.lineTo(x, y - len * 0.46);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBonuses() {
  for (const bonus of state.bonuses) {
    const x = laneX(bonus.lane, bonus.z);
    const y = laneY(bonus.z);
    const depth = projectZ(bonus.z).depth;
    const size = lerp(14, 64, depth);
    const pulse = 0.62 + 0.38 * Math.sin(state.time * 6 + bonus.pulse);
    const spin = state.time * (bonus.spin || 1.1);
    const hue = bonus.hue || 132;
    const coreY = y - size * 0.8;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const beam = ctx.createLinearGradient(x, coreY - size * 2.8, x, y + size * 1.6);
    beam.addColorStop(0, `hsla(${hue + 20} 100% 80% / 0)`);
    beam.addColorStop(0.25, `hsla(${hue + 10} 100% 70% / ${0.22 * pulse})`);
    beam.addColorStop(0.7, `hsla(${hue} 100% 60% / ${0.15 * pulse})`);
    beam.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.34, coreY - size * 2.8);
    ctx.lineTo(x + size * 0.34, coreY - size * 2.8);
    ctx.lineTo(x + size * 0.62, y + size * 1.4);
    ctx.lineTo(x - size * 0.62, y + size * 1.4);
    ctx.closePath();
    ctx.fill();

    const aura = ctx.createRadialGradient(x, coreY, 0, x, coreY, size * 2.3);
    aura.addColorStop(0, `hsla(${hue + 18} 100% 78% / ${0.46 * pulse})`);
    aura.addColorStop(1, `hsla(${hue} 100% 62% / 0)`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, coreY, size * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${hue + 12} 100% 76% / ${0.9 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, coreY, size * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `hsla(${hue + 26} 100% 84% / ${0.85 * pulse})`;
    ctx.lineWidth = Math.max(1.8, size * 0.08);
    ctx.beginPath();
    ctx.arc(x, coreY, size * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${hue + 40} 100% 90% / ${0.82 * pulse})`;
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.62, coreY);
    ctx.lineTo(x + size * 0.62, coreY);
    ctx.moveTo(x, coreY - size * 0.62);
    ctx.lineTo(x, coreY + size * 0.62);
    ctx.stroke();

    // rotating diamond frame
    ctx.save();
    ctx.translate(x, coreY);
    ctx.rotate(spin);
    ctx.strokeStyle = `hsla(${hue + 14} 100% 80% / ${0.75 * pulse})`;
    ctx.lineWidth = Math.max(1.5, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.05);
    ctx.lineTo(size * 1.05, 0);
    ctx.lineTo(0, size * 1.05);
    ctx.lineTo(-size * 1.05, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // orbiting highlights
    for (let i = 0; i < 3; i += 1) {
      const a = spin * 1.6 + i * ((Math.PI * 2) / 3);
      const ox = x + Math.cos(a) * size * 1.18;
      const oy = coreY + Math.sin(a) * size * 0.8;
      ctx.fillStyle = `hsla(${hue + 30} 100% 86% / ${0.8 * pulse})`;
      ctx.beginPath();
      ctx.arc(ox, oy, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // lane target ring at ground to make it obvious
    ctx.strokeStyle = `hsla(${hue + 8} 100% 74% / ${0.72 * pulse})`;
    ctx.lineWidth = Math.max(1.6, size * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.18, size * 0.95, size * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${hue + 20} 100% 86% / ${0.55 * pulse})`;
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.18, size * 1.28, size * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawFragments() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const frag of state.fragments) {
    const t = frag.life / frag.maxLife;
    const size = frag.size * (0.4 + t * 0.8);
    ctx.save();
    ctx.translate(frag.x, frag.y);
    ctx.rotate(frag.angle);
    ctx.fillStyle = hsla(frag.hue, frag.sat, frag.light, t * 0.92);
    ctx.fillRect(-size * 0.5, -size * 0.5, size, size * (0.58 + Math.sin(frag.angle) * 0.14));
    ctx.fillStyle = hsla(frag.hue + 24, 100, 78, t * 0.35);
    ctx.fillRect(-size * 0.24, -size * 0.24, size * 0.48, size * 0.2);
    ctx.restore();
  }
  ctx.restore();
}

function drawBlasts() {
  for (const blast of state.blasts) {
    const t = blast.life / blast.maxLife;
    const growth = blast.shockwave ? 1.95 : 1.2;
    const radius = blast.radius * (growth - t * (blast.shockwave ? 1.25 : 0.55));
    const alpha = (blast.muzzle ? 0.45 : blast.shockwave ? 0.58 : 0.72) * t;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = hsla(blast.hue, 100, 72, alpha);
    ctx.lineWidth = Math.max(1.2, radius * (blast.shockwave ? 0.05 : 0.08));
    ctx.beginPath();
    ctx.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = hsla(blast.hue + 12, 100, 64, alpha * (blast.shockwave ? 0.22 : 0.5));
    ctx.beginPath();
    ctx.arc(blast.x, blast.y, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    if (blast.shockwave) {
      const spokes = 8;
      ctx.strokeStyle = hsla(blast.hue + 18, 100, 74, alpha * 0.45);
      ctx.lineWidth = Math.max(1, radius * 0.018);
      for (let i = 0; i < spokes; i += 1) {
        const a = (i / spokes) * Math.PI * 2 + state.time * 0.6;
        ctx.beginPath();
        ctx.moveTo(blast.x + Math.cos(a) * radius * 0.4, blast.y + Math.sin(a) * radius * 0.4);
        ctx.lineTo(blast.x + Math.cos(a) * radius * 0.98, blast.y + Math.sin(a) * radius * 0.98);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawPowerupFlash() {
  if (state.powerupFlash <= 0) return;
  const t = state.powerupFlash;
  const cx = state.powerupFlashX;
  const cy = state.powerupFlashY;
  const hue = state.powerupHue;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const aura = ctx.createRadialGradient(
    cx,
    cy,
    state.height * 0.04,
    cx,
    cy,
    state.height * 0.46
  );
  aura.addColorStop(0, hsla(hue + 18, 100, 78, 0.45 * t));
  aura.addColorStop(0.45, hsla(hue + 2, 100, 68, 0.2 * t));
  aura.addColorStop(1, hsla(hue, 100, 56, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, state.width, state.height);

  const overlay = ctx.createLinearGradient(0, 0, 0, state.height);
  overlay.addColorStop(0, hsla(hue + 14, 100, 76, 0.12 * t));
  overlay.addColorStop(1, hsla(hue, 100, 62, 0.05 * t));
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = hsla(hue + 24, 100, 84, 0.42 * t);
  ctx.lineWidth = Math.max(2, state.height * 0.006 * t);
  ctx.beginPath();
  ctx.arc(cx, cy, state.height * (0.12 + (1 - t) * 0.08), 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = hsla(hue + 36, 100, 90, 0.24 * t);
  ctx.lineWidth = Math.max(1.5, state.height * 0.004 * t);
  ctx.beginPath();
  ctx.arc(cx, cy, state.height * (0.18 + (1 - t) * 0.12), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawOverlay() {
  if (!state.assets.ready) {
    ctx.fillStyle = "rgba(1, 8, 20, 0.56)";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7f7ff";

    const tsize = Math.round(clamp(state.width * 0.04, 20, 40));
    const bsize = Math.round(clamp(state.width * 0.02, 13, 22));

    ctx.font = `800 ${tsize}px Orbitron, sans-serif`;
    ctx.fillText("Loading Pixel Assets", state.width / 2, state.height * 0.42);

    ctx.font = `600 ${bsize}px Rajdhani, sans-serif`;
    if (state.assets.error) {
      ctx.fillText("Asset load failed. Refresh to retry.", state.width / 2, state.height * 0.53);
    } else {
      ctx.fillText("Preparing Space Runner systems...", state.width / 2, state.height * 0.53);
    }
    return;
  }

  if (state.phase === "running") return;

  const alpha = state.phase === "ready" ? 0.52 : 0.6;
  ctx.fillStyle = `rgba(1, 8, 20, ${alpha})`;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e7f7ff";

  const titleSize = Math.round(clamp(state.width * 0.046, 22, 48));
  const bodySize = Math.round(clamp(state.width * 0.021, 14, 24));

  if (state.phase === "ready") {
    ctx.font = `800 ${titleSize}px Orbitron, sans-serif`;
    ctx.fillText("Space Runner", state.width / 2, state.height * 0.34);
    ctx.font = `600 ${bodySize}px Rajdhani, sans-serif`;
    const controlsLine = state.isMobileViewport
      ? "Use \u2190 and \u2192 to move lanes, and FIRE button to blast"
      : "Left/Right to lane-shift, Space to fire blaster, Up/W to jump, M toggles music";
    ctx.fillText(controlsLine, state.width / 2, state.height * 0.49);
    ctx.fillText("Hit green power cores for spray-shot; miss 25 aliens and your ship explodes", state.width / 2, state.height * 0.56);
  } else if (state.phase === "paused") {
    const panelW = state.width * 0.46;
    const panelH = state.height * 0.2;
    const panelX = state.width / 2 - panelW / 2;
    const panelY = state.height * 0.34;

    ctx.fillStyle = "rgba(2, 12, 28, 0.78)";
    ctx.strokeStyle = "rgba(123, 220, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e7f7ff";
    ctx.font = `800 ${titleSize}px Orbitron, sans-serif`;
    ctx.fillText("Paused", state.width / 2, panelY + panelH * 0.45);
    ctx.font = `600 ${bodySize}px Rajdhani, sans-serif`;
    ctx.fillText("Press P or tap PAUSE to resume", state.width / 2, panelY + panelH * 0.72);
  } else {
    const panelW = state.width * 0.54;
    const panelH = state.height * 0.34;
    const panelX = state.width / 2 - panelW / 2;
    const panelY = state.height * 0.28;

    ctx.fillStyle = "rgba(2, 12, 28, 0.75)";
    ctx.strokeStyle = "rgba(123, 220, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e7f7ff";
    ctx.font = `800 ${titleSize}px Orbitron, sans-serif`;
    ctx.fillText("Game Over", state.width / 2, panelY + panelH * 0.28);

    const killsSize = Math.round(clamp(state.width * 0.04, 20, 42));
    ctx.font = `800 ${killsSize}px Orbitron, sans-serif`;
    ctx.fillStyle = "#93fbff";
    ctx.fillText(`Aliens Destroyed: ${state.kills}`, state.width / 2, panelY + panelH * 0.56);

    ctx.fillStyle = "#d9efff";
    ctx.font = `600 ${bodySize}px Rajdhani, sans-serif`;
    ctx.fillText(`Best Run: ${state.bestKills}`, state.width / 2, panelY + panelH * 0.73);
    ctx.fillText("Press Enter or tap to relaunch", state.width / 2, panelY + panelH * 0.88);
  }
}

function updateHud() {
  killsEl.textContent = String(state.kills);
  const healthPct = clamp(state.shipHealth, 0, SHIP_HEALTH_MAX);
  if (healthEl) healthEl.textContent = `${Math.round(healthPct)}%`;
  if (healthFillEl) {
    healthFillEl.style.width = `${healthPct.toFixed(1)}%`;
    if (healthPct > 60) {
      healthFillEl.style.filter = "saturate(1.05)";
    } else if (healthPct > 30) {
      healthFillEl.style.filter = "saturate(1.2)";
    } else {
      healthFillEl.style.filter = "saturate(1.4) brightness(1.1)";
    }
  }
  const speedText = `${(state.speed / BASE_SPEED).toFixed(1)}x`;
  speedEl.textContent = state.player.sprayTimer > 0
    ? `${speedText} | SPRAY ${state.player.sprayTimer.toFixed(1)}s`
    : speedText;

  if (mobileHealthEl) mobileHealthEl.textContent = String(Math.round(healthPct));
  if (mobileScoreEl) mobileScoreEl.textContent = String(state.kills);
  if (mobileBestEl) mobileBestEl.textContent = String(state.bestKills);
  if (mobileModeEl) {
    const label = state.phase === "running"
      ? "PLAY"
      : state.phase === "paused"
        ? "PAUSE"
        : state.phase === "gameover"
          ? "DOWN"
          : "READY";
    mobileModeEl.textContent = label;
  }
  if (pauseBtnEl) {
    const canToggle = state.phase === "running" || state.phase === "paused";
    pauseBtnEl.disabled = !canToggle;
    pauseBtnEl.textContent = state.phase === "paused" ? "RESUME (P)" : "PAUSE (P)";
  }
}

function render() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  if (state.cameraShake > 0) {
    const power = state.cameraShake * state.height * 0.012;
    const sx = random(-power, power);
    const sy = random(-power * 0.7, power * 0.7);
    ctx.translate(sx, sy);
  }
  drawBackground();
  drawRunway();
  drawShots();
  drawBonuses();
  drawObstacles();
  drawFragments();
  drawPlayer();
  drawSparks();
  drawBlasts();
  ctx.restore();
  drawPowerupFlash();
  drawOverlay();
}

function tick(time) {
  const deltaMs = Math.min(50, time - state.lastTime);
  const dt = deltaMs / 1000;
  state.lastTime = time;

  step(dt);
  render();
  requestAnimationFrame(tick);
}

function stopLaneInterval(side) {
  const key = side === "left" ? "leftInterval" : "rightInterval";
  if (state.mobile[key]) {
    clearInterval(state.mobile[key]);
    state.mobile[key] = null;
  }
}

function stopAllMobileMoveLoops() {
  stopLaneInterval("left");
  stopLaneInterval("right");
  state.mobile.leftPointerId = null;
  state.mobile.rightPointerId = null;
}

function stopMobileFireLoop() {
  if (state.mobile.fireInterval) {
    clearInterval(state.mobile.fireInterval);
    state.mobile.fireInterval = null;
  }
  state.mobile.firePointerId = null;
}

function handleLaneDown(side, dir, event) {
  if (!state.isMobileViewport) return;
  ensureAudio();
  event.preventDefault();

  if (state.phase === "gameover") {
    resetGame();
  }
  if (state.phase === "paused") return;

  const pointerKey = side === "left" ? "leftPointerId" : "rightPointerId";
  const intervalKey = side === "left" ? "leftInterval" : "rightInterval";
  const buttonEl = side === "left" ? leftBtnEl : rightBtnEl;
  if (!buttonEl) return;

  moveLane(dir);
  stopLaneInterval(side);
  state.mobile[pointerKey] = event.pointerId;
  if (buttonEl.setPointerCapture) {
    buttonEl.setPointerCapture(event.pointerId);
  }
  state.mobile[intervalKey] = setInterval(() => {
    moveLane(dir);
  }, 145);
}

function handleLaneUp(side, event) {
  const pointerKey = side === "left" ? "leftPointerId" : "rightPointerId";
  const buttonEl = side === "left" ? leftBtnEl : rightBtnEl;
  if (!buttonEl) return;
  if (state.mobile[pointerKey] !== event.pointerId) return;
  event.preventDefault();
  if (buttonEl.releasePointerCapture) {
    try {
      buttonEl.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Ignore release failures.
    }
  }
  stopLaneInterval(side);
  state.mobile[pointerKey] = null;
}

function handleFireDown(event) {
  if (!state.isMobileViewport || !fireBtnEl) return;
  ensureAudio();
  event.preventDefault();

  if (state.phase === "gameover") {
    resetGame();
  }
  if (state.phase === "paused") return;

  stopMobileFireLoop();
  state.mobile.firePointerId = event.pointerId;
  if (fireBtnEl.setPointerCapture) {
    fireBtnEl.setPointerCapture(event.pointerId);
  }

  shoot();
  state.mobile.fireInterval = setInterval(() => {
    if (state.phase === "running" || state.phase === "ready") {
      shoot();
    }
  }, 142);
}

function handleFireUp(event) {
  if (!fireBtnEl) return;
  if (state.mobile.firePointerId !== event.pointerId) return;
  event.preventDefault();
  if (fireBtnEl.releasePointerCapture) {
    try {
      fireBtnEl.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Ignore release failures.
    }
  }
  stopMobileFireLoop();
}

function handleKeydown(event) {
  ensureAudio();

  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (state.phase === "gameover") {
    if (event.code === "Enter" || event.code === "KeyR") {
      event.preventDefault();
      resetGame();
    }
    return;
  }

  if (["ArrowLeft", "KeyA"].includes(event.code)) {
    event.preventDefault();
    moveLane(-1);
    return;
  }

  if (["ArrowRight", "KeyD"].includes(event.code)) {
    event.preventDefault();
    moveLane(1);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    shoot();
    return;
  }

  if (event.code === "KeyM") {
    event.preventDefault();
    ensureAudio();
    setMusicEnabled(!audioState.musicEnabled);
    return;
  }

  if (["ArrowUp", "KeyW"].includes(event.code)) {
    event.preventDefault();
    jump();
  }
}

function handlePointerDown(event) {
  if (state.isMobileViewport) {
    if (state.phase === "gameover") {
      resetGame();
    }
    return;
  }
  ensureAudio();
  state.touchStart = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
}

function handlePointerUp(event) {
  if (state.isMobileViewport) return;

  if (state.phase === "gameover") {
    resetGame();
    state.touchStart = null;
    return;
  }

  const start = state.touchStart;
  state.touchStart = null;

  if (!start) {
    shoot();
    return;
  }

  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX > 28 && absX > absY) {
    moveLane(dx > 0 ? 1 : -1);
    return;
  }

  if (dy < -24) {
    jump();
    return;
  }

  shoot();
}

window.addEventListener("keydown", handleKeydown);
if (musicToggleEl) {
  musicToggleEl.addEventListener("click", () => {
    ensureAudio();
    setMusicEnabled(!audioState.musicEnabled);
  });
}
if (pauseBtnEl) {
  pauseBtnEl.addEventListener("click", () => {
    ensureAudio();
    togglePause();
  });
}
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", () => {
  state.touchStart = null;
});
if (leftBtnEl) {
  leftBtnEl.addEventListener("pointerdown", (event) => handleLaneDown("left", -1, event));
  leftBtnEl.addEventListener("pointerup", (event) => handleLaneUp("left", event));
  leftBtnEl.addEventListener("pointercancel", (event) => handleLaneUp("left", event));
}
if (rightBtnEl) {
  rightBtnEl.addEventListener("pointerdown", (event) => handleLaneDown("right", 1, event));
  rightBtnEl.addEventListener("pointerup", (event) => handleLaneUp("right", event));
  rightBtnEl.addEventListener("pointercancel", (event) => handleLaneUp("right", event));
}
if (fireBtnEl) {
  fireBtnEl.addEventListener("pointerdown", handleFireDown);
  fireBtnEl.addEventListener("pointerup", handleFireUp);
  fireBtnEl.addEventListener("pointercancel", handleFireUp);
}
window.addEventListener("resize", resizeCanvas);
window.addEventListener("blur", () => {
  stopMobileFireLoop();
  stopAllMobileMoveLoops();
});
if (MOBILE_QUERY.addEventListener) {
  MOBILE_QUERY.addEventListener("change", () => {
    syncViewportMode();
    resizeCanvas();
    updateHud();
  });
} else if (MOBILE_QUERY.addListener) {
  MOBILE_QUERY.addListener(() => {
    syncViewportMode();
    resizeCanvas();
    updateHud();
  });
}

resizeCanvas();
seedVisuals();
resetGame();
setMusicEnabled(true);
loadAssets();
requestAnimationFrame((time) => {
  state.lastTime = time;
  tick(time);
});

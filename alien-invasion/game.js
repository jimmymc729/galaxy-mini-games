const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const uiHealth = document.getElementById("healthValue");
const uiScore = document.getElementById("scoreValue");
const uiHighScore = document.getElementById("highScoreValue");
const uiStatus = document.getElementById("statusValue");
const nextCityButton = document.getElementById("nextCityButton");
const pauseButton = document.getElementById("pauseButton");
const mbStickZone = document.getElementById("mbStickZone");
const mbStickKnob = document.getElementById("mbStickKnob");
const mbFire = document.getElementById("mbFire");

const HIGH_SCORE_KEY = "ufo_city_rampage_high_score_v1";

const WORLD = {
  viewWidth: canvas.width,
  viewHeight: canvas.height,
  width: 4600,
  tileSize: 48,
  groundY: 640,
  gravityBomb: 1350,
};

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 }, // 16:9
  mobile: { width: 1080, height: 800 },  // taller mobile framing
};

const BUILDING_PHYSICS = {
  collapseStep: 0.12,
  gravity: 1800,
};

const CIVILIANS = {
  streetSpacingMin: 140,
  streetSpacingMax: 260,
  windowChance: 0.16,
};

const CIVILIAN_VEHICLES = {
  spacingMin: 300,
  spacingMax: 520,
  minSpeed: 50,
  maxSpeed: 92,
};

const CITY_BACKDROPS = [
  {
    skyTop: "#16364a",
    skyMid: "#275a55",
    skyBottom: "#1d3a35",
    orbInner: "rgba(245,248,225,0.96)",
    orbMid: "rgba(245,248,225,0.3)",
    orbOuter: "rgba(245,248,225,0)",
    orbRadius: 170,
    skylineFar: "rgba(23, 50, 62, 0.36)",
    skylineNear: "rgba(9, 30, 38, 0.5)",
    grid: "rgba(255,255,255,0.06)",
    gridStep: 38,
  },
  {
    skyTop: "#1a243f",
    skyMid: "#303b66",
    skyBottom: "#29364d",
    orbInner: "rgba(202,220,255,0.92)",
    orbMid: "rgba(165,185,255,0.26)",
    orbOuter: "rgba(165,185,255,0)",
    orbRadius: 150,
    skylineFar: "rgba(31, 33, 74, 0.38)",
    skylineNear: "rgba(16, 23, 51, 0.52)",
    grid: "rgba(200,220,255,0.07)",
    gridStep: 36,
  },
  {
    skyTop: "#3e2b16",
    skyMid: "#644423",
    skyBottom: "#3d2b1b",
    orbInner: "rgba(255,214,120,0.94)",
    orbMid: "rgba(255,178,90,0.24)",
    orbOuter: "rgba(255,178,90,0)",
    orbRadius: 180,
    skylineFar: "rgba(74, 44, 23, 0.38)",
    skylineNear: "rgba(43, 25, 14, 0.52)",
    grid: "rgba(255,220,175,0.065)",
    gridStep: 40,
  },
  {
    skyTop: "#163228",
    skyMid: "#1d4c3b",
    skyBottom: "#122b24",
    orbInner: "rgba(174,255,226,0.88)",
    orbMid: "rgba(108,243,184,0.24)",
    orbOuter: "rgba(108,243,184,0)",
    orbRadius: 165,
    skylineFar: "rgba(23, 58, 45, 0.36)",
    skylineNear: "rgba(8, 34, 29, 0.5)",
    grid: "rgba(193,255,230,0.06)",
    gridStep: 34,
  },
  {
    skyTop: "#30173b",
    skyMid: "#4a2660",
    skyBottom: "#2a1538",
    orbInner: "rgba(255,174,244,0.9)",
    orbMid: "rgba(218,122,255,0.24)",
    orbOuter: "rgba(218,122,255,0)",
    orbRadius: 175,
    skylineFar: "rgba(58, 26, 79, 0.36)",
    skylineNear: "rgba(32, 14, 51, 0.54)",
    grid: "rgba(255,220,255,0.06)",
    gridStep: 38,
  },
];

function rect(sx, sy, sw, sh) {
  return { sx, sy, sw, sh };
}

/*
  =========================
  SPRITE ATLAS (EDIT HERE)
  =========================
  Source rectangles for assets/sprites.png.

  Debug controls:
  - G: toggle debug atlas overlay
  - [ / ]: previous / next frame entry
  - Arrow keys: move selected rectangle (sx/sy)
  - Shift + Arrow keys: resize selected rectangle (sw/sh)
  - Alt + Arrow keys: nudge by 10 instead of 1
  - P: print ATLAS JSON in console
*/
const ATLAS = {
  // Building facade tiles
  window_full: [rect(46, 146, 110, 82)],
  window_cracked: [rect(188, 146, 110, 82)],
  window_broken: [rect(329, 146, 110, 82)],
  window_hole: [rect(471, 146, 110, 82)],
  roof_tile: [rect(43, 267, 146, 45)],
  ground_tile: [rect(198, 267, 146, 45)],

  // Tank enemy and projectile
  tank_move: [
    rect(42, 734, 133, 74),
    rect(194, 734, 133, 74),
  ],
  tank_shoot: [rect(194, 734, 133, 74)],
  bullet: [rect(371, 775, 44, 24)],

  // Effects
  explosion: [
    rect(44, 872, 116, 93),
    rect(183, 872, 116, 93),
    rect(322, 872, 116, 93),
  ],
  impact: [rect(455, 857, 140, 118)],
  debris: [rect(322, 872, 116, 93)],

  // Retained for easier future sprite use
  monster_idle: [
    rect(19, 377, 164, 217),
    rect(183, 377, 164, 217),
    rect(348, 377, 164, 217),
  ],
  monster_walk: [
    rect(612, 492, 148, 186),
    rect(775, 492, 148, 186),
    rect(938, 492, 148, 186),
    rect(1101, 492, 148, 186),
    rect(1264, 492, 148, 186),
  ],
  monster_climb: [
    rect(612, 685, 148, 186),
    rect(775, 685, 148, 186),
    rect(938, 685, 148, 186),
    rect(1101, 685, 148, 186),
    rect(1264, 685, 148, 186),
  ],
  monster_punch: [
    rect(612, 893, 116, 78),
    rect(746, 893, 116, 78),
    rect(880, 893, 116, 78),
    rect(1014, 893, 116, 78),
  ],
};

class SpriteAtlas {
  constructor(atlasData) {
    this.atlasData = atlasData;
  }

  getFrame(name, index = 0) {
    const frames = this.atlasData[name];
    if (!frames || frames.length === 0) return null;
    return frames[((index % frames.length) + frames.length) % frames.length];
  }

  getCount(name) {
    const frames = this.atlasData[name];
    return frames ? frames.length : 0;
  }

  getEntries() {
    const out = [];
    Object.entries(this.atlasData).forEach(([name, frames]) => {
      frames.forEach((frame, i) => out.push({ name, frameIndex: i, frame }));
    });
    return out;
  }
}

class SpriteSheet {
  constructor(image, atlas) {
    this.image = image;
    this.atlas = atlas;
  }

  draw(ctx2d, spriteName, frameIndex, dx, dy, dw, dh, options = {}) {
    const frame = this.atlas.getFrame(spriteName, frameIndex);
    if (!frame) {
      this.drawMissing(ctx2d, dx, dy, dw, dh, "#ff4f8a");
      return;
    }

    const loaded = this.image.complete && this.image.naturalWidth > 0;
    if (!loaded) {
      this.drawMissing(ctx2d, dx, dy, dw, dh, "#58c9ff");
      return;
    }

    const { sx, sy, sw, sh } = frame;
    const { flipX = false, alpha = 1, rotation = 0 } = options;

    ctx2d.save();
    ctx2d.globalAlpha = alpha;

    if (flipX || rotation !== 0) {
      const cx = dx + dw * 0.5;
      const cy = dy + dh * 0.5;
      ctx2d.translate(cx, cy);
      ctx2d.rotate(rotation);
      ctx2d.scale(flipX ? -1 : 1, 1);
      ctx2d.drawImage(this.image, sx, sy, sw, sh, -dw * 0.5, -dh * 0.5, dw, dh);
    } else {
      ctx2d.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    ctx2d.restore();
  }

  drawMissing(ctx2d, dx, dy, dw, dh, color) {
    ctx2d.save();
    ctx2d.fillStyle = color;
    ctx2d.fillRect(dx, dy, dw, dh);
    ctx2d.strokeStyle = "#142136";
    ctx2d.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2);
    ctx2d.restore();
  }
}

const spriteImage = new Image();
spriteImage.src = "assets/sprites.png";

const spriteAtlas = new SpriteAtlas(ATLAS);
const spriteSheet = new SpriteSheet(spriteImage, spriteAtlas);

/*
  ===============================
  BOSS SPRITE SOURCE (EDIT HERE)
  ===============================
  Source rectangle for assets/robot-boss.png.
  Use a PNG with real transparency for best results.
*/
const BOSS_SPRITE = {
  // Crop area for the robot in assets/robot-boss.png.
  sx: 370,
  sy: 185,
  sw: 830,
  sh: 740,
};

const bossImage = new Image();
bossImage.src = "assets/robot-boss.png";

/*
  ==============================
  UFO SPRITE SOURCE (EDIT HERE)
  ==============================
  Source rectangle for assets/ufo.png.
*/
const UFO_SPRITE = {
  sx: 270,
  sy: 240,
  sw: 1000,
  sh: 560,
};

const ufoImage = new Image();
ufoImage.src = "assets/ufo.png";

const AUDIO = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  compressor: null,
  noiseBuffer: null,
  music: null,
  muted: false,
  unlocked: false,
  collapseCooldown: 0,
  sfxVariants: Object.create(null),
};

const MUSIC_THEMES = {
  city: {
    tempo: 98,
    length: 16,
    lead: [57, null, 64, null, 60, null, 57, null, 55, null, 62, null, 58, null, 55, null],
    bass: [33, null, null, null, 31, null, null, null, 29, null, null, null, 31, null, null, null],
    arp: [45, null, 52, 48, 43, null, 50, 47, 41, null, 48, 45, 43, null, 50, 46],
    drums: ["K", null, "H", null, null, "H", null, "S", "K", null, "H", null, null, "H", "S", null],
  },
  boss: {
    tempo: 124,
    length: 16,
    lead: [53, 55, 58, 60, 58, 55, 53, null, 52, 53, 57, 58, 57, 53, 52, null],
    bass: [29, null, 29, null, 28, null, 27, null, 26, null, 26, null, 25, null, 24, null],
    arp: [41, 44, 48, 44, 40, 43, 46, 43, 38, 41, 45, 41, 37, 40, 44, 40],
    drums: ["K", null, "H", "S", "K", null, "H", "S", "K", null, "H", "S", "K", null, "S", "H"],
  },
};

function ensureAudio() {
  if (AUDIO.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctxAudio = new Ctx();
  const master = ctxAudio.createGain();
  const sfxBus = ctxAudio.createGain();
  const musicBus = ctxAudio.createGain();
  const compressor = ctxAudio.createDynamicsCompressor();

  master.gain.value = 0.2;
  sfxBus.gain.value = 1;
  musicBus.gain.value = 0.18;

  compressor.threshold.value = -20;
  compressor.knee.value = 16;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;

  sfxBus.connect(compressor);
  musicBus.connect(compressor);
  compressor.connect(master);
  master.connect(ctxAudio.destination);

  AUDIO.ctx = ctxAudio;
  AUDIO.master = master;
  AUDIO.sfxBus = sfxBus;
  AUDIO.musicBus = musicBus;
  AUDIO.compressor = compressor;
  AUDIO.noiseBuffer = null;
  AUDIO.music = {
    theme: "city",
    step: 0,
    nextTime: 0,
    armed: false,
  };
}

function unlockAudio() {
  ensureAudio();
  if (!AUDIO.ctx) return;
  if (AUDIO.ctx.state === "suspended") AUDIO.ctx.resume();
  AUDIO.unlocked = AUDIO.ctx.state === "running";
  if (AUDIO.unlocked) startMusicIfNeeded();
}

function setMuted(muted) {
  AUDIO.muted = muted;
  if (AUDIO.master) AUDIO.master.gain.value = muted ? 0 : 0.2;
  if (AUDIO.music && AUDIO.ctx) {
    AUDIO.music.nextTime = AUDIO.ctx.currentTime + 0.05;
  }
  if (!muted) startMusicIfNeeded();
}

function getAudioBus(bus) {
  if (bus === "music" && AUDIO.musicBus) return AUDIO.musicBus;
  return AUDIO.sfxBus || AUDIO.master;
}

function getNoiseBuffer() {
  if (!AUDIO.ctx) return null;
  if (AUDIO.noiseBuffer) return AUDIO.noiseBuffer;

  const buffer = AUDIO.ctx.createBuffer(1, Math.floor(AUDIO.ctx.sampleRate * 0.5), AUDIO.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  AUDIO.noiseBuffer = buffer;
  return buffer;
}

function nextSfxVariant(key, count) {
  const current = AUDIO.sfxVariants[key] ?? 0;
  AUDIO.sfxVariants[key] = (current + 1) % count;
  return current;
}

function vary(base, ratio = 0.08) {
  return base * (1 + randomRange(-ratio, ratio));
}

function tone({
  freq = 440,
  type = "sine",
  attack = 0.002,
  decay = 0.12,
  gain = 0.12,
  slideTo = null,
  duration = null,
  atTime = null,
  detune = 0,
  bus = "sfx",
  lowpass = null,
  highpass = null,
}) {
  if (!AUDIO.ctx || !AUDIO.master || AUDIO.muted) return;
  const now = AUDIO.ctx.currentTime;
  const start = atTime ?? now;
  const dur = duration ?? (attack + decay);
  const end = start + dur;
  const target = getAudioBus(bus);

  const osc = AUDIO.ctx.createOscillator();
  const g = AUDIO.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), start);
  osc.detune.value = detune;
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), end);

  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  let tail = osc;
  if (lowpass != null) {
    const lp = AUDIO.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    tail.connect(lp);
    tail = lp;
  }
  if (highpass != null) {
    const hp = AUDIO.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    tail.connect(hp);
    tail = hp;
  }

  tail.connect(g);
  g.connect(target);

  osc.start(start);
  osc.stop(end + 0.02);
}

function noiseBurst({
  attack = 0.001,
  decay = 0.12,
  gain = 0.1,
  highpass = 220,
  lowpass = null,
  playbackRate = null,
  startOffset = null,
  atTime = null,
  bus = "sfx",
}) {
  if (!AUDIO.ctx || !AUDIO.master || AUDIO.muted) return;
  const ctxAudio = AUDIO.ctx;
  const now = atTime ?? ctxAudio.currentTime;
  const target = getAudioBus(bus);
  const buffer = getNoiseBuffer();
  if (!buffer) return;

  const src = ctxAudio.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = playbackRate != null ? playbackRate : vary(1, 0.14);

  const hp = ctxAudio.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpass;

  let tail = hp;
  if (lowpass != null) {
    const lp = ctxAudio.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    tail.connect(lp);
    tail = lp;
  }

  const g = ctxAudio.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(gain, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

  src.connect(hp);
  tail.connect(g);
  g.connect(target);

  const dur = attack + decay + 0.03;
  const explicitOffset = startOffset != null ? Math.max(0, startOffset) : null;
  const maxRandomOffset = Math.max(0, buffer.duration - dur - 0.01);
  const noiseOffset = explicitOffset != null
    ? Math.min(explicitOffset, Math.max(0, buffer.duration - 0.01))
    : randomRange(0, maxRandomOffset);

  src.start(now, noiseOffset);
  src.stop(now + dur);
}

function sfxBombDrop() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("bombDrop", 3);
  const leadType = v === 0 ? "triangle" : v === 1 ? "sawtooth" : "square";
  const leadStart = v === 2 ? 680 : 610;
  const leadEnd = v === 1 ? 210 : 165;
  tone({
    freq: vary(leadStart, 0.08),
    type: leadType,
    gain: vary(0.055, 0.2),
    attack: 0.002,
    decay: 0.15 + randomRange(-0.02, 0.03),
    slideTo: vary(leadEnd, 0.14),
    detune: randomRange(-20, 20),
    atTime: now,
    lowpass: vary(1800, 0.16),
  });
  tone({
    freq: vary(v === 1 ? 240 : 205, 0.08),
    type: v === 2 ? "triangle" : "sine",
    gain: vary(0.03, 0.25),
    attack: 0.001,
    decay: 0.11 + randomRange(-0.02, 0.03),
    slideTo: vary(82, 0.2),
    detune: randomRange(-10, 10),
    atTime: now,
  });
  if (Math.random() < 0.55) {
    tone({
      freq: vary(960, 0.1),
      type: "square",
      gain: vary(0.013, 0.25),
      attack: 0.001,
      decay: randomRange(0.022, 0.04),
      atTime: now ? now + randomRange(0.01, 0.022) : null,
      highpass: 1000,
    });
  }
  noiseBurst({
    gain: vary(0.019, 0.28),
    decay: randomRange(0.03, 0.06),
    highpass: vary(2000, 0.16),
    lowpass: vary(6200, 0.18),
    atTime: now ? now + randomRange(0.006, 0.016) : null,
  });
}

function sfxExplosion(strength = 1) {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("explosion", 4);
  const bodyFreq = [158, 172, 144, 186][v];
  const rumbleFreq = [58, 64, 54, 68][v];
  noiseBurst({
    gain: vary(0.12 * strength, 0.24),
    decay: 0.2 + 0.09 * strength + randomRange(-0.03, 0.04),
    highpass: vary(72, 0.35),
    lowpass: vary(2450, 0.2),
    atTime: now,
  });
  noiseBurst({
    gain: vary(0.055 * strength, 0.28),
    decay: 0.085 + 0.04 * strength + randomRange(-0.02, 0.02),
    highpass: vary(1450, 0.25),
    lowpass: vary(6400, 0.18),
    atTime: now ? now + randomRange(0.016, 0.035) : null,
  });
  tone({
    freq: vary(bodyFreq, 0.09),
    type: v % 2 === 0 ? "sawtooth" : "triangle",
    gain: vary(0.068 * strength, 0.22),
    attack: 0.001,
    decay: 0.23 + randomRange(0.02, 0.1),
    slideTo: vary(42, 0.14),
    detune: randomRange(-22, 22),
    atTime: now,
    lowpass: vary(720, 0.14),
  });
  tone({
    freq: vary(rumbleFreq, 0.11),
    type: "sine",
    gain: vary(0.074 * strength, 0.2),
    attack: 0.002,
    decay: 0.3 + randomRange(0.01, 0.1),
    slideTo: vary(33, 0.16),
    atTime: now,
  });
  if (Math.random() < 0.6) {
    noiseBurst({
      gain: vary(0.03 * strength, 0.35),
      decay: randomRange(0.045, 0.09),
      highpass: vary(2400, 0.25),
      lowpass: vary(7600, 0.2),
      atTime: now ? now + randomRange(0.04, 0.075) : null,
    });
  }
}

function sfxTankShot() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("tankShot", 3);
  const fireType = v === 1 ? "sawtooth" : "square";
  tone({
    freq: vary(780 + v * 55, 0.08),
    type: fireType,
    gain: vary(0.044, 0.2),
    attack: 0.001,
    decay: randomRange(0.05, 0.07),
    slideTo: vary(330 + v * 28, 0.12),
    detune: randomRange(-16, 16),
    atTime: now,
    highpass: vary(420, 0.2),
  });
  noiseBurst({
    gain: vary(0.026, 0.24),
    decay: randomRange(0.045, 0.065),
    highpass: vary(920, 0.2),
    lowpass: vary(5200, 0.14),
    atTime: now,
  });
  if (Math.random() < 0.45) {
    tone({
      freq: vary(1180, 0.1),
      type: "square",
      gain: vary(0.012, 0.28),
      attack: 0.001,
      decay: randomRange(0.018, 0.032),
      atTime: now ? now + randomRange(0.007, 0.016) : null,
      highpass: 900,
    });
  }
}

function sfxBossShot() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("bossShot", 3);
  tone({
    freq: vary(220 + v * 20, 0.08),
    type: v === 0 ? "sawtooth" : v === 1 ? "square" : "triangle",
    gain: vary(0.094, 0.2),
    attack: 0.001,
    decay: randomRange(0.15, 0.2),
    slideTo: vary(90 - v * 5, 0.12),
    detune: randomRange(-14, 14),
    atTime: now,
    lowpass: vary(1150, 0.18),
  });
  tone({
    freq: vary(112 - v * 6, 0.1),
    type: "triangle",
    gain: vary(0.048, 0.2),
    attack: 0.001,
    decay: randomRange(0.13, 0.18),
    slideTo: vary(58, 0.15),
    atTime: now ? now + randomRange(0, 0.01) : null,
  });
  noiseBurst({
    gain: vary(0.078, 0.2),
    decay: randomRange(0.09, 0.13),
    highpass: vary(250, 0.2),
    lowpass: vary(3800, 0.16),
    atTime: now,
  });
}

function sfxBossHit() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  tone({
    freq: vary(320, 0.1),
    type: Math.random() < 0.5 ? "square" : "triangle",
    gain: vary(0.048, 0.24),
    attack: 0.001,
    decay: randomRange(0.08, 0.12),
    slideTo: vary(160, 0.2),
    detune: randomRange(-18, 18),
    atTime: now,
  });
  noiseBurst({
    gain: vary(0.03, 0.28),
    decay: randomRange(0.06, 0.09),
    highpass: vary(1100, 0.2),
    lowpass: vary(5400, 0.16),
    atTime: now,
  });
}

function sfxBossDown() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  noiseBurst({ gain: vary(0.16, 0.18), decay: randomRange(0.25, 0.34), highpass: vary(80, 0.18), lowpass: vary(2600, 0.16), atTime: now });
  noiseBurst({ gain: vary(0.08, 0.2), decay: randomRange(0.14, 0.2), highpass: vary(1200, 0.2), atTime: now ? now + randomRange(0.02, 0.05) : null });
  tone({ freq: vary(142, 0.08), type: "triangle", gain: vary(0.09, 0.18), attack: 0.002, decay: randomRange(0.34, 0.44), slideTo: vary(36, 0.14), atTime: now });
  tone({ freq: vary(72, 0.1), type: "sine", gain: vary(0.07, 0.2), attack: 0.002, decay: randomRange(0.4, 0.52), slideTo: vary(30, 0.14), atTime: now ? now + randomRange(0.008, 0.02) : null });
}

function sfxUfoHit() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("ufoHit", 3);
  tone({
    freq: vary(330 - v * 24, 0.08),
    type: v === 1 ? "triangle" : "square",
    gain: vary(0.052, 0.22),
    attack: 0.001,
    decay: randomRange(0.1, 0.15),
    slideTo: vary(145 - v * 12, 0.12),
    detune: randomRange(-16, 16),
    atTime: now,
    highpass: vary(360, 0.2),
  });
  noiseBurst({
    gain: vary(0.043, 0.24),
    decay: randomRange(0.07, 0.11),
    highpass: vary(520, 0.2),
    lowpass: vary(4200, 0.16),
    atTime: now,
  });
}

function sfxCollapse() {
  const now = AUDIO.ctx ? AUDIO.ctx.currentTime : null;
  const v = nextSfxVariant("collapse", 3);
  tone({
    freq: vary(116 - v * 6, 0.1),
    type: v === 2 ? "sine" : "triangle",
    gain: vary(0.043, 0.2),
    attack: 0.001,
    decay: randomRange(0.12, 0.18),
    slideTo: vary(50, 0.16),
    atTime: now,
  });
  noiseBurst({
    gain: vary(0.02, 0.28),
    decay: randomRange(0.06, 0.09),
    highpass: vary(280, 0.2),
    lowpass: vary(1400, 0.18),
    atTime: now,
  });
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function chipNote(time, midi, duration, gain, type, detune = 0) {
  if (midi == null) return;
  const freq = midiToFreq(midi);
  tone({
    freq,
    type,
    gain,
    attack: 0.002,
    decay: Math.max(0.04, duration * 0.9),
    duration,
    atTime: time,
    detune,
    bus: "music",
    lowpass: type === "triangle" ? 1800 : 2600,
  });
}

function musicKick(time) {
  tone({ freq: 132, type: "sine", gain: 0.12, attack: 0.001, decay: 0.14, slideTo: 42, atTime: time, duration: 0.16, bus: "music" });
  noiseBurst({ gain: 0.02, decay: 0.03, highpass: 800, atTime: time, bus: "music" });
}

function musicSnare(time) {
  noiseBurst({ gain: 0.06, decay: 0.08, highpass: 1200, lowpass: 5800, atTime: time, bus: "music" });
  tone({ freq: 210, type: "triangle", gain: 0.032, attack: 0.001, decay: 0.07, slideTo: 130, atTime: time, duration: 0.09, bus: "music" });
}

function musicHat(time) {
  noiseBurst({ gain: 0.028, decay: 0.026, highpass: 4200, atTime: time, bus: "music" });
}

function setMusicTheme(theme, force = false) {
  if (!AUDIO.music) return;
  if (!force && AUDIO.music.theme === theme) return;
  AUDIO.music.theme = theme;
  AUDIO.music.step = 0;
  AUDIO.music.nextTime = AUDIO.ctx ? AUDIO.ctx.currentTime + 0.03 : 0;
}

function startMusicIfNeeded() {
  if (!AUDIO.ctx || !AUDIO.unlocked || !AUDIO.music) return;
  if (AUDIO.music.armed) return;
  AUDIO.music.armed = true;
  AUDIO.music.step = 0;
  AUDIO.music.nextTime = AUDIO.ctx.currentTime + 0.05;
}

function scheduleMusicStep(theme, step, time) {
  const i = step % theme.length;
  const stepDuration = 60 / theme.tempo / 2;

  chipNote(time, theme.lead[i], stepDuration * 0.92, 0.033, "sine");
  chipNote(time, theme.lead[i], stepDuration * 0.72, 0.013, "triangle", i % 2 === 0 ? 7 : -7);
  chipNote(time, theme.bass[i], stepDuration * 0.98, 0.042, "triangle", -4);
  chipNote(time, theme.arp[i], stepDuration * 0.64, 0.014, "square", 4);

  const drum = theme.drums[i];
  if (drum === "K") musicKick(time);
  if (drum === "S") musicSnare(time);
  if (drum === "H") musicHat(time);
}

function updateMusic() {
  if (!AUDIO.ctx || !AUDIO.unlocked || AUDIO.muted || !AUDIO.music || !AUDIO.music.armed) return;
  if (AUDIO.music.nextTime < AUDIO.ctx.currentTime - 0.5) {
    AUDIO.music.nextTime = AUDIO.ctx.currentTime + 0.03;
  }
  const desired = state && state.boss ? "boss" : "city";
  if (AUDIO.music.theme !== desired) {
    setMusicTheme(desired, true);
  }

  const theme = MUSIC_THEMES[AUDIO.music.theme];
  if (!theme) return;
  const stepDuration = 60 / theme.tempo / 2;
  const lookAhead = 0.2;
  const horizon = AUDIO.ctx.currentTime + lookAhead;

  while (AUDIO.music.nextTime < horizon) {
    scheduleMusicStep(theme, AUDIO.music.step, AUDIO.music.nextTime);
    AUDIO.music.step = (AUDIO.music.step + 1) % theme.length;
    AUDIO.music.nextTime += stepDuration;
  }
}

function cityBackdropFor(cityIndex) {
  const base = CITY_BACKDROPS[(cityIndex - 1) % CITY_BACKDROPS.length];
  const span = Math.max(180, WORLD.viewWidth - 180);
  const orbX = 120 + ((cityIndex * 173) % span);
  const orbY = 110 + ((cityIndex * 97) % 160);
  return {
    ...base,
    orbX,
    orbY,
  };
}

const input = {
  down: Object.create(null),
  pressed: Object.create(null),
};

const mobileStick = {
  active: false,
  x: 0,
  y: 0,
};

const debug = {
  enabled: false,
  entries: [],
  selected: 0,
};

let state;
let lastTime = performance.now();

function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
    const value = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // ignore storage failures
  }
}

function maybeUpdateHighScore() {
  if (!state) return;
  const score = Math.floor(state.score);
  if (score > state.highScore) {
    state.highScore = score;
    saveHighScore(score);
  }
}

function resetGame() {
  const buildings = buildCity();
  const civilians = createCivilians(buildings);
  const vehicles = createCivilianVehicles();
  state = {
    time: 0,
    score: 0,
    highScore: loadHighScore(),
    health: 100,
    gameOver: false,
    paused: false,
    cityIndex: 1,
    nextCityReady: false,
    bossSpawned: false,
    bossSpawnDelay: 0,
    cameraX: 0,
    backdrop: cityBackdropFor(1),
    skyline: buildSkyline(),
    buildings,
    bombs: [],
    tankBullets: [],
    fx: [],
    particles: [],
    fallingTiles: [],
    collapseTimer: 0,
    civilians,
    vehicles,

    ufo: {
      x: 220,
      y: 220,
      vx: 0,
      vy: 0,
      w: 132,
      h: 72,
      accel: 1900,
      maxSpeed: 430,
      bombCooldown: 0,
      hitFlash: 0,
      invuln: 0,
    },

    tanks: seedTanks(buildings),
    boss: null,
    cameraShake: 0,
  };

  setNextCityButtonVisible(false);
  AUDIO.collapseCooldown = 0;
  refreshDebugEntries();
  updatePauseButtonUI();
  if (AUDIO.music) setMusicTheme("city", true);
}

function setNextCityButtonVisible(visible) {
  if (!nextCityButton) return;
  nextCityButton.classList.toggle("is-visible", visible);
}

function updatePauseButtonUI() {
  if (!pauseButton || !state) return;
  const canPause = !state.gameOver && !debug.enabled;
  pauseButton.disabled = !canPause;
  pauseButton.textContent = state.paused ? "Resume (P)" : "Pause (P)";
}

function togglePause(forcePaused = null) {
  if (!state || state.gameOver || debug.enabled) return;
  state.paused = forcePaused == null ? !state.paused : !!forcePaused;
  updatePauseButtonUI();
}

function startNextCity() {
  if (!state || state.gameOver || !state.nextCityReady) return;

  state.cityIndex += 1;
  const buildings = buildCity();
  state.skyline = buildSkyline();
  state.backdrop = cityBackdropFor(state.cityIndex);
  state.buildings = buildings;
  state.civilians = createCivilians(buildings);
  state.vehicles = createCivilianVehicles();
  state.tanks = seedTanks(buildings);

  state.bombs = [];
  state.tankBullets = [];
  state.fx = [];
  state.particles = [];
  state.fallingTiles = [];
  state.collapseTimer = 0;
  state.cameraShake = 0;
  state.nextCityReady = false;
  state.bossSpawned = false;
  state.bossSpawnDelay = 0;
  state.boss = null;

  state.health = Math.min(100, state.health + 20);
  state.ufo.x = 220;
  state.ufo.y = 220;
  state.ufo.vx = 0;
  state.ufo.vy = 0;
  state.ufo.bombCooldown = 0;
  state.ufo.hitFlash = 0;
  state.ufo.invuln = 0;
  state.cameraX = 0;
  state.paused = false;

  setNextCityButtonVisible(false);
  updatePauseButtonUI();
  if (AUDIO.music) setMusicTheme("city", true);
}

function buildCity() {
  const buildings = [];
  let x = 180;
  let id = 0;

  while (x < WORLD.width - 260) {
    const cols = randInt(3, 6);
    const rows = randInt(7, 12);
    buildings.push(createBuilding(id, x, cols, rows));
    id += 1;
    x += cols * WORLD.tileSize + randInt(70, 190);
  }

  return buildings;
}

function createBuilding(id, x, cols, rows) {
  return {
    id,
    x,
    cols,
    rows,
    width: cols * WORLD.tileSize,
    yTop: WORLD.groundY - rows * WORLD.tileSize,
    tiles: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
  };
}

function buildSkyline() {
  const blocks = [];
  let x = -120;
  while (x < WORLD.width + 200) {
    const w = randInt(140, 260);
    const h = randInt(120, 320);
    blocks.push({ x, w, h });
    x += w + randInt(40, 110);
  }
  return blocks;
}

function seedTanks(buildings) {
  const tanks = [];
  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    if (Math.random() < 0.78) {
      tanks.push(createTank(b.x + b.width * 0.5 + randInt(-40, 40)));
    }
  }

  // Ensure some starting pressure
  for (let i = 0; i < 4; i += 1) {
    tanks.push(createTank(randInt(350, WORLD.width - 250)));
  }

  return tanks;
}

function createTank(x) {
  return {
    x,
    y: WORLD.groundY,
    dir: Math.random() < 0.5 ? -1 : 1,
    speed: randomRange(42, 72),
    shootCooldown: randomRange(0.4, 1.8),
    animTime: Math.random() * 10,
    flash: 0,
  };
}

function createBoss(x) {
  return {
    x,
    y: WORLD.groundY,
    dir: -1,
    speed: 92,
    w: 200,
    h: 158,
    hp: 950,
    maxHp: 950,
    flash: 0,
    hitFlash: 0,
    animTime: 0,
    attackCooldown: 1.2,
    burstShots: 0,
    burstTimer: 0,
  };
}

function createCivilians(buildings) {
  const street = [];
  const roof = [];
  const windows = [];
  const windowMap = new Map();

  let sx = 120;
  while (sx < WORLD.width - 120) {
    const c = makeStreetCivilian(sx + randomRange(-28, 28));
    street.push(c);
    sx += randomRange(CIVILIANS.streetSpacingMin, CIVILIANS.streetSpacingMax);
  }

  for (const b of buildings) {
    const roofCount = randInt(0, Math.max(1, Math.floor(b.cols * 0.6)));
    for (let i = 0; i < roofCount; i += 1) {
      roof.push(makeRoofCivilian(b, b.x + randomRange(14, Math.max(16, b.width - 14))));
    }

    for (let row = 1; row < b.rows; row += 1) {
      for (let col = 0; col < b.cols; col += 1) {
        if (Math.random() > CIVILIANS.windowChance) continue;
        const w = makeWindowCivilian(b, row, col);
        windows.push(w);
        windowMap.set(w.key, w);
      }
    }
  }

  return { street, roof, windows, windowMap };
}

function createCivilianVehicles() {
  const vehicles = [];
  let x = 100;
  while (x < WORLD.width - 120) {
    if (Math.random() < 0.82) {
      vehicles.push({
        x: x + randomRange(-35, 35),
        y: WORLD.groundY,
        dir: Math.random() < 0.5 ? -1 : 1,
        speed: randomRange(CIVILIAN_VEHICLES.minSpeed, CIVILIAN_VEHICLES.maxSpeed),
        turnTimer: randomRange(1.4, 4.4),
        panic: 0,
        tint: randInt(0, 4),
        hp: 1,
        hitFlash: 0,
      });
    }
    x += randomRange(CIVILIAN_VEHICLES.spacingMin, CIVILIAN_VEHICLES.spacingMax);
  }
  return vehicles;
}

function makeStreetCivilian(x) {
  return {
    x,
    dir: Math.random() < 0.5 ? -1 : 1,
    speed: randomRange(26, 46),
    panic: 0,
    turnTimer: randomRange(1.2, 3.8),
    phase: Math.random() * Math.PI * 2,
    tint: randInt(0, 4),
    hp: 1,
    hurtTimer: 0,
    dying: 0,
  };
}

function makeRoofCivilian(building, x) {
  return {
    building,
    x,
    dir: Math.random() < 0.5 ? -1 : 1,
    speed: randomRange(18, 34),
    panic: 0,
    turnTimer: randomRange(1.0, 3.0),
    phase: Math.random() * Math.PI * 2,
    tint: randInt(0, 4),
    hp: 1,
    hurtTimer: 0,
    dying: 0,
  };
}

function makeWindowCivilian(building, row, col) {
  return {
    key: windowKey(building.id, row, col),
    building,
    row,
    col,
    visible: Math.random() < 0.65,
    blink: randomRange(0.35, 2.5),
    panic: 0,
    phase: Math.random() * Math.PI * 2,
    tint: randInt(0, 4),
    hp: 1,
    hurtTimer: 0,
    dying: 0,
  };
}

function windowKey(buildingId, row, col) {
  return `${buildingId}:${row}:${col}`;
}

function keyDown(code) {
  return !!input.down[code];
}

function keyPressed(code) {
  return !!input.pressed[code];
}

function clearPressed() {
  input.pressed = Object.create(null);
}

function axisX() {
  const digital = (keyDown("ArrowLeft") || keyDown("KeyA") ? -1 : 0)
    + (keyDown("ArrowRight") || keyDown("KeyD") ? 1 : 0);
  return clamp(digital + (mobileStick.active ? mobileStick.x : 0), -1, 1);
}

function axisY() {
  const digital = (keyDown("ArrowUp") || keyDown("KeyW") ? -1 : 0)
    + (keyDown("ArrowDown") || keyDown("KeyS") ? 1 : 0);
  return clamp(digital + (mobileStick.active ? mobileStick.y : 0), -1, 1);
}

function update(dt) {
  if (debug.enabled) {
    updatePauseButtonUI();
    updateDebugAtlasEditor();
    return;
  }

  updatePauseButtonUI();
  if (state.gameOver || state.paused) return;

  updateMusic();

  state.time += dt;
  AUDIO.collapseCooldown = Math.max(0, AUDIO.collapseCooldown - dt);

  updateUfo(dt);
  updateBombs(dt);
  updateBuildingCollapse(dt);
  updateFallingTiles(dt);
  updateCivilians(dt);
  updateCivilianVehicles(dt);
  updateTanks(dt);
  updateBoss(dt);
  updateTankBullets(dt);
  updateFx(dt);
  updateParticles(dt);
  updateCamera(dt);
  state.cameraShake = Math.max(0, state.cameraShake - dt * 2.8);

  if (state.health <= 0) {
    state.health = 0;
    state.gameOver = true;
    setNextCityButtonVisible(false);
    return;
  }

  if (!state.bossSpawned && state.tanks.length === 0) {
    state.bossSpawnDelay += dt;
    if (state.bossSpawnDelay >= 0.9) {
      spawnBoss();
    }
  }

  if (!state.nextCityReady && state.tanks.length === 0 && !state.boss && state.bossSpawned) {
    state.nextCityReady = true;
    setNextCityButtonVisible(true);
  }
}

function spawnBoss() {
  if (state.boss || state.bossSpawned) return;

  const spawnX = clamp(state.cameraX + WORLD.viewWidth * 0.75, 220, WORLD.width - 220);
  state.boss = createBoss(spawnX);
  state.bossSpawned = true;
  state.bossSpawnDelay = 0;
  state.nextCityReady = false;
  setNextCityButtonVisible(false);
  notifyExplosion(spawnX, WORLD.groundY - 80, 150, { damageVehicles: false });
  spawnFx("explosion", spawnX, WORLD.groundY - 60, 1.25);
  spawnParticles(spawnX, WORLD.groundY - 90, 16, 1.15);
  state.cameraShake = Math.max(state.cameraShake, 0.28);
  if (AUDIO.music) setMusicTheme("boss", true);
}

function updateUfo(dt) {
  const ufo = state.ufo;

  const ax = axisX() * ufo.accel;
  const ay = axisY() * ufo.accel;

  ufo.vx += ax * dt;
  ufo.vy += ay * dt;

  const drag = 4.8;
  ufo.vx -= ufo.vx * drag * dt;
  ufo.vy -= ufo.vy * drag * dt;

  const speed = Math.hypot(ufo.vx, ufo.vy);
  if (speed > ufo.maxSpeed) {
    const inv = ufo.maxSpeed / speed;
    ufo.vx *= inv;
    ufo.vy *= inv;
  }

  ufo.x += ufo.vx * dt;
  ufo.y += ufo.vy * dt;

  const edge = ufo.w * 0.5 + 6;
  ufo.x = clamp(ufo.x, edge, WORLD.width - edge);
  ufo.y = clamp(ufo.y, Math.max(72, ufo.h * 0.55), WORLD.groundY - 120);

  ufo.bombCooldown = Math.max(0, ufo.bombCooldown - dt);
  ufo.hitFlash = Math.max(0, ufo.hitFlash - dt);
  ufo.invuln = Math.max(0, ufo.invuln - dt);

  if (keyDown("Space") && ufo.bombCooldown <= 0) {
    dropBomb();
    ufo.bombCooldown = 0.18;
  }
}

function dropBomb() {
  const ufo = state.ufo;
  state.bombs.push({
    x: ufo.x,
    y: ufo.y + ufo.h * 0.3,
    vx: ufo.vx * 0.2,
    vy: 90,
    r: 7,
    life: 4,
  });
  sfxBombDrop();
}

function updateBombs(dt) {
  for (let i = state.bombs.length - 1; i >= 0; i -= 1) {
    const b = state.bombs[i];
    b.life -= dt;
    b.vy += WORLD.gravityBomb * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.life <= 0 || b.x < -100 || b.x > WORLD.width + 100) {
      state.bombs.splice(i, 1);
      continue;
    }

    let exploded = false;

    const boss = state.boss;
    if (boss) {
      const bossCoreY = boss.y - boss.h * 0.54;
      if (Math.abs(boss.x - b.x) < boss.w * 0.36 && Math.abs(bossCoreY - b.y) < boss.h * 0.34) {
        explodeBomb(b.x, b.y, 104);
        exploded = true;
      }
    }

    if (exploded) {
      state.bombs.splice(i, 1);
      continue;
    }

    for (let t = state.tanks.length - 1; t >= 0; t -= 1) {
      const tank = state.tanks[t];
      if (Math.abs(tank.x - b.x) < 34 && Math.abs((tank.y - 24) - b.y) < 28) {
        explodeBomb(b.x, b.y, 88);
        destroyTank(t);
        exploded = true;
        break;
      }
    }

    if (!exploded && state.vehicles) {
      for (let v = state.vehicles.length - 1; v >= 0; v -= 1) {
        const car = state.vehicles[v];
        if (Math.abs(car.x - b.x) < 24 && Math.abs((car.y - 14) - b.y) < 18) {
          explodeBomb(b.x, b.y, 84);
          exploded = true;
          break;
        }
      }
    }

    if (exploded) {
      state.bombs.splice(i, 1);
      continue;
    }

    const tile = getTileAt(b.x, b.y);
    if (tile && tile.state < 3) {
      explodeBomb(b.x, b.y, 84);
      state.bombs.splice(i, 1);
      continue;
    }

    if (b.y >= WORLD.groundY - 3) {
      explodeBomb(b.x, WORLD.groundY - 3, 72);
      state.bombs.splice(i, 1);
      continue;
    }
  }
}

function explodeBomb(x, y, radius) {
  sfxExplosion(clamp(radius / 90, 0.7, 1.3));
  notifyExplosion(x, y, radius);
  spawnFx("explosion", x, y, 1.08);
  spawnParticles(x, y, 12, 1.1);

  const tilesDamaged = damageTilesInRadius(x, y, radius);
  if (tilesDamaged > 0) {
    state.score += tilesDamaged * 3;
  }

  for (let i = state.tanks.length - 1; i >= 0; i -= 1) {
    const tank = state.tanks[i];
    if (Math.abs(tank.x - x) < radius * 0.52 && Math.abs((tank.y - 26) - y) < radius * 0.42) {
      destroyTank(i);
    }
  }

  damageBossInRadius(x, y, radius);
}

function damageTilesInRadius(x, y, radius) {
  let damageCount = 0;

  for (const b of state.buildings) {
    if (x + radius < b.x || x - radius > b.x + b.width) continue;

    for (let row = 0; row < b.rows; row += 1) {
      for (let col = 0; col < b.cols; col += 1) {
        const tx = b.x + col * WORLD.tileSize + WORLD.tileSize * 0.5;
        const ty = b.yTop + row * WORLD.tileSize + WORLD.tileSize * 0.5;
        const dist = Math.hypot(tx - x, ty - y);
        if (dist > radius) continue;

        const steps = dist < radius * 0.42 ? 2 : 1;
        const gained = applyTileDamage(b, row, col, steps);
        if (gained > 0) {
          damageCount += gained;
          if (Math.random() < 0.38) {
            spawnFx(gained >= 2 ? "explosion" : "impact", tx, ty, gained >= 2 ? 0.76 : 0.5);
          }
        }
      }
    }
  }

  return damageCount;
}

function applyTileDamage(building, row, col, steps) {
  let current = building.tiles[row][col];
  let changed = 0;

  for (let i = 0; i < steps; i += 1) {
    if (current >= 3) break;
    current += 1;
    changed += 1;

    if (current === 1) state.score += 10;
    if (current === 2) state.score += 18;
    if (current === 3) state.score += 32;
  }

  building.tiles[row][col] = current;

  if (changed > 0) {
    const cx = building.x + col * WORLD.tileSize + WORLD.tileSize * 0.5;
    const cy = building.yTop + row * WORLD.tileSize + WORLD.tileSize * 0.5;
    spawnParticles(cx, cy, changed === 2 ? 5 : 3, 0.7);
  }

  return changed;
}

function damageBossInRadius(x, y, radius) {
  const boss = state.boss;
  if (!boss) return;

  const coreX = boss.x;
  const coreY = boss.y - boss.h * 0.52;
  const dist = Math.hypot(coreX - x, coreY - y);
  if (dist > radius * 1.2) return;

  const falloff = clamp(1 - dist / (radius * 1.2), 0.2, 1);
  const amount = Math.floor(70 * falloff);
  damageBoss(amount, x, y);
}

function updateBuildingCollapse(dt) {
  state.collapseTimer += dt;
  while (state.collapseTimer >= BUILDING_PHYSICS.collapseStep) {
    state.collapseTimer -= BUILDING_PHYSICS.collapseStep;
    runCollapseStep();
  }
}

function runCollapseStep() {
  for (const b of state.buildings) {
    const supported = Array.from({ length: b.rows }, () => Array.from({ length: b.cols }, () => false));
    const queue = [];
    const bottom = b.rows - 1;

    for (let col = 0; col < b.cols; col += 1) {
      if (b.tiles[bottom][col] < 3) {
        supported[bottom][col] = true;
        queue.push([bottom, col]);
      }
    }

    while (queue.length > 0) {
      const [row, col] = queue.pop();
      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= b.rows || nc < 0 || nc >= b.cols) continue;
        if (supported[nr][nc]) continue;
        if (b.tiles[nr][nc] >= 3) continue;
        supported[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }

    for (let row = 0; row < b.rows; row += 1) {
      for (let col = 0; col < b.cols; col += 1) {
        const tileState = b.tiles[row][col];
        if (tileState >= 3) continue;
        if (supported[row][col]) continue;
        collapseTile(b, row, col, tileState);
      }
    }
  }
}

function collapseTile(building, row, col, tileState) {
  building.tiles[row][col] = 3;

  const x = building.x + col * WORLD.tileSize;
  const y = building.yTop + row * WORLD.tileSize;
  const sprite = row === 0
    ? "roof_tile"
    : tileState <= 0
      ? "window_full"
      : tileState === 1
        ? "window_cracked"
        : "window_broken";

  state.fallingTiles.push({
    x,
    y,
    vx: randomRange(-85, 85),
    vy: randomRange(-130, -20),
    rot: randomRange(-0.5, 0.5),
    spin: randomRange(-4, 4),
    sprite,
    life: 2.6,
    settled: false,
    alpha: 1,
  });

  state.score += row === 0 ? 14 : 7;
  notifyExplosion(x + WORLD.tileSize * 0.5, y + WORLD.tileSize * 0.5, 52);
  spawnParticles(x + WORLD.tileSize * 0.5, y + WORLD.tileSize * 0.5, 3, 0.62);
  if (AUDIO.collapseCooldown <= 0) {
    sfxCollapse();
    AUDIO.collapseCooldown = 0.055;
  }
}

function updateFallingTiles(dt) {
  const floorY = WORLD.groundY - WORLD.tileSize;

  for (let i = state.fallingTiles.length - 1; i >= 0; i -= 1) {
    const block = state.fallingTiles[i];
    block.life -= dt;

    if (!block.settled) {
      block.vy += BUILDING_PHYSICS.gravity * dt;
      block.x += block.vx * dt;
      block.y += block.vy * dt;
      block.rot += block.spin * dt;
      block.vx *= 1 - Math.min(0.8, dt * 2.2);

      if (block.y >= floorY) {
        block.y = floorY;
        if (Math.abs(block.vy) > 120) {
          block.vy *= -0.22;
          block.vx *= 0.72;
          spawnParticles(block.x + WORLD.tileSize * 0.5, block.y + WORLD.tileSize * 0.8, 2, 0.46);
        } else {
          block.vy = 0;
          block.settled = true;
          block.life = Math.min(block.life, 1.0);
          block.spin *= 0.3;
        }
      }
    } else {
      block.alpha = clamp(block.life / 1.0, 0, 1);
    }

    if (block.life <= 0) {
      state.fallingTiles.splice(i, 1);
    }
  }
}

function updateCivilians(dt) {
  const crowd = state.civilians;
  if (!crowd) return;

  for (let i = crowd.street.length - 1; i >= 0; i -= 1) {
    const c = crowd.street[i];
    c.hurtTimer = Math.max(0, c.hurtTimer - dt);
    if (c.dying > 0) {
      c.dying -= dt;
      if (c.dying <= 0) crowd.street.splice(i, 1);
      continue;
    }

    c.panic = Math.max(0, c.panic - dt);
    c.turnTimer -= dt;

    const speed = c.speed + (c.panic > 0 ? 60 : 0);
    c.x += c.dir * speed * dt;

    if (c.x < 20) {
      c.x = 20;
      c.dir = 1;
    } else if (c.x > WORLD.width - 20) {
      c.x = WORLD.width - 20;
      c.dir = -1;
    } else if (c.turnTimer <= 0) {
      if (Math.random() < 0.22) c.dir *= -1;
      c.turnTimer = randomRange(1.0, 3.6);
    }
  }

  for (let i = crowd.roof.length - 1; i >= 0; i -= 1) {
    const c = crowd.roof[i];
    const b = c.building;
    c.hurtTimer = Math.max(0, c.hurtTimer - dt);
    if (c.dying > 0) {
      c.dying -= dt;
      if (c.dying <= 0) crowd.roof.splice(i, 1);
      continue;
    }

    c.panic = Math.max(0, c.panic - dt);
    c.turnTimer -= dt;

    const col = clamp(Math.floor((c.x - b.x) / WORLD.tileSize), 0, b.cols - 1);
    if (b.tiles[0][col] >= 3) {
      crowd.street.push(makeStreetCivilian(c.x));
      crowd.street[crowd.street.length - 1].panic = 2.5;
      crowd.roof.splice(i, 1);
      continue;
    }

    const left = b.x + 10;
    const right = b.x + b.width - 10;
    const speed = c.speed + (c.panic > 0 ? 36 : 0);
    c.x += c.dir * speed * dt;

    if (c.x <= left) {
      c.x = left;
      c.dir = 1;
    } else if (c.x >= right) {
      c.x = right;
      c.dir = -1;
    } else if (c.turnTimer <= 0) {
      if (Math.random() < 0.3) c.dir *= -1;
      c.turnTimer = randomRange(0.8, 2.8);
    }
  }

  for (let i = crowd.windows.length - 1; i >= 0; i -= 1) {
    const c = crowd.windows[i];
    c.hurtTimer = Math.max(0, c.hurtTimer - dt);
    if (c.dying > 0) {
      c.dying -= dt;
      c.visible = true;
      if (c.dying <= 0) {
        crowd.windowMap.delete(c.key);
        crowd.windows.splice(i, 1);
      }
      continue;
    }

    c.panic = Math.max(0, c.panic - dt);
    c.blink -= dt;

    const tileState = c.building.tiles[c.row][c.col];
    if (tileState >= 3) {
      crowd.windowMap.delete(c.key);
      crowd.windows.splice(i, 1);
      continue;
    }

    if (c.blink <= 0) {
      if (c.panic > 0) {
        c.visible = false;
        c.blink = randomRange(0.5, 1.3);
      } else {
        c.visible = Math.random() < 0.7;
        c.blink = randomRange(0.45, 3.2);
      }
    }
  }
}

function updateCivilianVehicles(dt) {
  const vehicles = state.vehicles;
  if (!vehicles) return;

  for (let i = vehicles.length - 1; i >= 0; i -= 1) {
    const v = vehicles[i];
    v.hitFlash = Math.max(0, v.hitFlash - dt);
    v.panic = Math.max(0, v.panic - dt);
    v.turnTimer -= dt;

    const speed = v.speed + (v.panic > 0 ? 66 : 0);
    v.x += v.dir * speed * dt;

    if (v.x < 30) {
      v.x = 30;
      v.dir = 1;
    } else if (v.x > WORLD.width - 30) {
      v.x = WORLD.width - 30;
      v.dir = -1;
    } else if (v.turnTimer <= 0) {
      if (Math.random() < 0.18) v.dir *= -1;
      v.turnTimer = randomRange(1.2, 4.1);
    }
  }
}

function damageStreetCivilian(crowd, index) {
  const c = crowd.street[index];
  if (!c || c.dying > 0 || c.hp <= 0) return;
  c.hp = 0;
  c.hurtTimer = 0.38;
  c.dying = 0.38;
  c.panic = 3;
}

function damageRoofCivilian(crowd, index) {
  const c = crowd.roof[index];
  if (!c || c.dying > 0 || c.hp <= 0) return;
  c.hp = 0;
  c.hurtTimer = 0.38;
  c.dying = 0.38;
  c.panic = 3;
}

function damageWindowCivilian(crowd, index) {
  const c = crowd.windows[index];
  if (!c || c.dying > 0 || c.hp <= 0) return;
  c.hp = 0;
  c.hurtTimer = 0.34;
  c.dying = 0.34;
  c.visible = true;
}

function damageVehicle(index, hitX, hitY, amount = 1) {
  const v = state.vehicles[index];
  if (!v) return;
  v.hp -= amount;
  v.hitFlash = 0.2;
  v.panic = Math.max(v.panic, 2.4);
  if (v.hp <= 0) {
    explodeVehicle(index, hitX, hitY);
  }
}

function explodeVehicle(index, x, y) {
  const v = state.vehicles[index];
  if (!v) return;

  const exX = x ?? v.x;
  const exY = y ?? (v.y - 12);
  state.vehicles.splice(index, 1);

  sfxExplosion(1.05);
  spawnFx("explosion", exX, exY, 0.96);
  spawnParticles(exX, exY, 10, 0.95);
  state.score += 45;

  // Prevent recursive vehicle-to-vehicle explosion chains in one stack.
  notifyExplosion(exX, exY, 92, { damageVehicles: false });
  damageTilesInRadius(exX, exY, 56);

  for (let i = state.tanks.length - 1; i >= 0; i -= 1) {
    const tank = state.tanks[i];
    if (Math.abs(tank.x - exX) < 66 && Math.abs((tank.y - 24) - exY) < 42) {
      destroyTank(i);
    }
  }

  damageBossInRadius(exX, exY, 88);
}

function notifyExplosion(x, y, radius, options = {}) {
  const { damageVehicles = true } = options;
  const crowd = state.civilians;
  if (!crowd && !state.vehicles) return;

  if (crowd) {
    for (let i = crowd.street.length - 1; i >= 0; i -= 1) {
      const c = crowd.street[i];
      const cy = WORLD.groundY - 3;
      const dist = Math.hypot(c.x - x, cy - y);
      if (dist > radius * 1.2) continue;
      c.panic = Math.max(c.panic, 2.3);
      c.dir = c.x < x ? -1 : 1;
      if (dist <= radius * 0.72) damageStreetCivilian(crowd, i);
    }

    for (let i = crowd.roof.length - 1; i >= 0; i -= 1) {
      const c = crowd.roof[i];
      const cy = c.building.yTop - 3;
      const dist = Math.hypot(c.x - x, cy - y);
      if (dist > radius * 1.1) continue;
      c.panic = Math.max(c.panic, 2.8);
      c.dir = c.x < x ? -1 : 1;
      if (dist <= radius * 0.68) damageRoofCivilian(crowd, i);
    }

    for (let i = crowd.windows.length - 1; i >= 0; i -= 1) {
      const c = crowd.windows[i];
      const wx = c.building.x + c.col * WORLD.tileSize + WORLD.tileSize * 0.5;
      const wy = c.building.yTop + c.row * WORLD.tileSize + WORLD.tileSize * 0.5;
      const dist = Math.hypot(wx - x, wy - y);
      if (dist > radius * 1.2) continue;
      c.visible = false;
      c.panic = Math.max(c.panic, 2.0);
      c.blink = randomRange(0.2, 1.2);
      if (dist <= radius * 0.7) damageWindowCivilian(crowd, i);
    }
  }

  const vehicles = state.vehicles;
  if (vehicles && damageVehicles) {
    for (let i = vehicles.length - 1; i >= 0; i -= 1) {
      const v = vehicles[i];
      const dist = Math.hypot(v.x - x, (v.y - 12) - y);
      if (dist > radius * 1.2) continue;
      v.panic = Math.max(v.panic, 2.4);
      v.dir = v.x < x ? -1 : 1;
      if (dist <= radius * 0.88) damageVehicle(i, v.x, v.y - 12, 1);
    }
  }
}

function updateBoss(dt) {
  const boss = state.boss;
  if (!boss) return;

  const ufo = state.ufo;
  boss.animTime += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  const dx = ufo.x - boss.x;
  const adx = Math.abs(dx);
  if (adx > 10) boss.dir = dx >= 0 ? 1 : -1;

  if (adx > 140) {
    const move = Math.min(adx, boss.speed * dt) * boss.dir;
    boss.x = clamp(boss.x + move, 120, WORLD.width - 120);
  }

  if (boss.burstShots > 0) {
    boss.burstTimer -= dt;
    if (boss.burstTimer <= 0) {
      fireBossVolley(boss);
      boss.burstShots -= 1;
      boss.burstTimer = 0.22;
    }
  } else {
    boss.attackCooldown -= dt;
    if (boss.attackCooldown <= 0) {
      boss.burstShots = randInt(2, 4);
      boss.burstTimer = 0;
      boss.attackCooldown = randomRange(1.4, 2.2);
    }
  }
}

function fireBossVolley(boss) {
  const ufo = state.ufo;
  const sxBase = boss.x + boss.dir * 34;
  const syBase = boss.y - boss.h * 0.7;
  const toX = ufo.x - sxBase;
  const toY = (ufo.y + 6) - syBase;
  const base = Math.atan2(toY, toX);

  for (const spread of [-0.26, 0, 0.26]) {
    const angle = base + spread;
    const speed = 520;
    spawnEnemyShot({
      x: sxBase,
      y: syBase,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: 14,
      life: 4.2,
      radius: 13,
      kind: "boss",
    });
  }

  boss.flash = 0.15;
  sfxBossShot();
}

function updateTanks(dt) {
  const ufo = state.ufo;

  for (let i = state.tanks.length - 1; i >= 0; i -= 1) {
    const tank = state.tanks[i];
    tank.animTime += dt;
    tank.flash = Math.max(0, tank.flash - dt);

    const dx = ufo.x - tank.x;
    const adx = Math.abs(dx);
    const wantDir = dx >= 0 ? 1 : -1;
    if (adx > 0.1) tank.dir = wantDir;

    if (adx > 270) {
      tank.x += tank.dir * tank.speed * dt;
      tank.x = clamp(tank.x, 28, WORLD.width - 28);
      tank.shootCooldown = Math.max(0.2, tank.shootCooldown - dt * 0.4);
    } else {
      tank.shootCooldown -= dt;
      if (tank.shootCooldown <= 0) {
        fireTankShot(tank);
        tank.flash = 0.13;
        tank.shootCooldown = randomRange(1.0, 1.8);
      }
    }
  }
}

function fireTankShot(tank) {
  const ufo = state.ufo;

  const sx = tank.x + tank.dir * 20;
  const sy = tank.y - 34;

  const toX = ufo.x - sx;
  const toY = (ufo.y + 4) - sy;
  const len = Math.max(0.001, Math.hypot(toX, toY));

  const speed = 430;
  const vx = (toX / len) * speed;
  const vy = (toY / len) * speed;

  spawnEnemyShot({
    x: sx,
    y: sy,
    vx,
    vy,
    damage: 8,
    life: 4,
    radius: 9,
    kind: "tank",
  });
  sfxTankShot();
}

function spawnEnemyShot({
  x,
  y,
  vx,
  vy,
  damage,
  life,
  radius,
  kind,
}) {
  state.tankBullets.push({
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    damage,
    life,
    radius,
    kind,
  });
}

function updateTankBullets(dt) {
  for (let i = state.tankBullets.length - 1; i >= 0; i -= 1) {
    const shot = state.tankBullets[i];
    shot.life -= dt;
    shot.px = shot.x;
    shot.py = shot.y;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;

    if (shot.life <= 0 || shot.x < -80 || shot.x > WORLD.width + 80 || shot.y < -120 || shot.y > WORLD.viewHeight + 240) {
      state.tankBullets.splice(i, 1);
      continue;
    }

    if (hitVehicleByShot(shot)) {
      state.tankBullets.splice(i, 1);
      continue;
    }

    if (ufoHit(shot.x, shot.y, shot.radius || 8)) {
      state.tankBullets.splice(i, 1);
      if (state.ufo.invuln <= 0) {
        damageUfo(shot.damage || 8, shot.x, shot.y);
      }
    }
  }
}

function hitVehicleByShot(shot) {
  const vehicles = state.vehicles;
  if (!vehicles || vehicles.length === 0) return false;

  for (let i = vehicles.length - 1; i >= 0; i -= 1) {
    const v = vehicles[i];
    if (Math.abs(v.x - shot.x) > 22) continue;
    if (Math.abs((v.y - 14) - shot.y) > 14) continue;
    damageVehicle(i, shot.x, shot.y, 1);
    return true;
  }

  return false;
}

function ufoHit(x, y, radius = 0) {
  const ufo = state.ufo;
  const dx = (x - ufo.x) / (ufo.w * 0.5 + radius);
  const dy = (y - (ufo.y - 2)) / (ufo.h * 0.5 + radius);
  return dx * dx + dy * dy <= 1;
}

function damageUfo(amount, hitX, hitY) {
  if (state.gameOver) return;
  state.health -= amount;
  state.ufo.hitFlash = 0.34;
  state.ufo.invuln = 0.32;
  state.cameraShake = Math.max(state.cameraShake, 0.32);
  spawnFx("impact", hitX, hitY, 0.52);
  sfxUfoHit();
}

function damageBoss(amount, hitX, hitY) {
  const boss = state.boss;
  if (!boss) return;
  boss.hp -= amount;
  boss.hitFlash = 0.24;
  state.score += Math.max(2, Math.floor(amount * 0.45));
  spawnFx("impact", hitX, hitY, 0.64);
  spawnParticles(hitX, hitY, 4, 0.7);
  sfxBossHit();

  if (boss.hp <= 0) {
    destroyBoss();
  }
}

function destroyTank(index) {
  const t = state.tanks[index];
  if (!t) return;
  notifyExplosion(t.x, t.y - 24, 96);
  spawnFx("explosion", t.x, t.y - 24, 1.02);
  spawnParticles(t.x, t.y - 24, 9, 1.0);
  state.score += 75;
  state.tanks.splice(index, 1);
}

function destroyBoss() {
  const boss = state.boss;
  if (!boss) return;
  notifyExplosion(boss.x, boss.y - boss.h * 0.52, 180);
  spawnFx("explosion", boss.x, boss.y - boss.h * 0.62, 1.55);
  spawnParticles(boss.x, boss.y - boss.h * 0.52, 30, 1.45);
  state.cameraShake = Math.max(state.cameraShake, 0.58);
  state.score += 1200;
  state.boss = null;
  sfxBossDown();
}

function updateCamera(dt) {
  const target = state.ufo.x - WORLD.viewWidth * 0.36;
  state.cameraX += (target - state.cameraX) * Math.min(1, dt * 4.6);
  state.cameraX = clamp(state.cameraX, 0, WORLD.width - WORLD.viewWidth);
}

function spawnFx(type, x, y, scale = 1) {
  const life = type === "explosion" ? 0.34 : 0.16;
  state.fx.push({ type, x, y, scale, t: 0, life });
}

function updateFx(dt) {
  for (let i = state.fx.length - 1; i >= 0; i -= 1) {
    const fx = state.fx[i];
    fx.t += dt;
    if (fx.t >= fx.life) state.fx.splice(i, 1);
  }
}

function spawnParticles(x, y, count, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const speed = randomRange(85, 270) * power;
    const angle = randomRange(-Math.PI * 0.98, -Math.PI * 0.02);
    const life = randomRange(0.35, 0.85);

    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: randomRange(0, Math.PI * 2),
      spin: randomRange(-4, 4),
      life,
      maxLife: life,
    });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.vy += 980 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    p.life -= dt;

    if (p.life <= 0 || p.y > WORLD.viewHeight + 50) state.particles.splice(i, 1);
  }
}

function getTileAt(worldX, worldY) {
  for (const b of state.buildings) {
    if (worldX < b.x || worldX >= b.x + b.width) continue;
    if (worldY < b.yTop || worldY >= WORLD.groundY) continue;

    const col = Math.floor((worldX - b.x) / WORLD.tileSize);
    const row = Math.floor((worldY - b.yTop) / WORLD.tileSize);
    if (row < 0 || row >= b.rows || col < 0 || col >= b.cols) continue;

    return {
      building: b,
      row,
      col,
      state: b.tiles[row][col],
      x: b.x + col * WORLD.tileSize,
      y: b.yTop + row * WORLD.tileSize,
    };
  }

  return null;
}

function draw() {
  let shakeX = 0;
  let shakeY = 0;
  if (state.cameraShake > 0) {
    const amp = 10 * state.cameraShake;
    shakeX = randomRange(-amp, amp);
    shakeY = randomRange(-amp * 0.55, amp * 0.55);
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawGround();
  drawBuildings();
  drawCivilians();
  drawCivilianVehicles();
  drawFallingTiles();
  drawTanks();
  drawBoss();
  drawTankBullets();
  drawBombs();
  drawUfo();
  drawParticles();
  drawFx();
  ctx.restore();

  drawDamageOverlay();

  if (state.paused && !state.gameOver && !debug.enabled) drawPaused();
  if (state.gameOver) drawGameOver();
  if (debug.enabled) drawDebugAtlasOverlay();

  maybeUpdateHighScore();
  uiHealth.textContent = String(Math.max(0, Math.floor(state.health)));
  uiScore.textContent = String(Math.floor(state.score));
  if (uiHighScore) uiHighScore.textContent = String(Math.floor(state.highScore));

  if (state.gameOver) {
    uiStatus.textContent = "GAME OVER";
    uiStatus.style.color = "#ff8e8e";
  } else if (state.paused) {
    uiStatus.textContent = "PAUSED";
    uiStatus.style.color = "#ffe69e";
  } else if (state.boss) {
    uiStatus.textContent = "BOSS ENGAGED";
    uiStatus.style.color = "#ffd57c";
  } else if (state.nextCityReady) {
    uiStatus.textContent = `CITY ${state.cityIndex} CLEAR`;
    uiStatus.style.color = "#c2f091";
  } else if (debug.enabled) {
    uiStatus.textContent = "DEBUG";
    uiStatus.style.color = "#f7d36f";
  } else {
    uiStatus.textContent = "PLAY";
    uiStatus.style.color = "#9ed8ff";
  }

  uiHealth.style.color = state.health > 30 ? "#70f090" : "#ff9a6e";
}

function sx(worldX) {
  return worldX - state.cameraX;
}

function drawBackground() {
  const bg = state.backdrop || cityBackdropFor(1);

  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.viewHeight);
  grad.addColorStop(0, bg.skyTop);
  grad.addColorStop(0.5, bg.skyMid);
  grad.addColorStop(1, bg.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.viewWidth, WORLD.viewHeight);

  const orb = ctx.createRadialGradient(bg.orbX, bg.orbY, 18, bg.orbX, bg.orbY, bg.orbRadius);
  orb.addColorStop(0, bg.orbInner);
  orb.addColorStop(0.45, bg.orbMid);
  orb.addColorStop(1, bg.orbOuter);
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(bg.orbX, bg.orbY, bg.orbRadius, 0, Math.PI * 2);
  ctx.fill();

  // Far skyline layer
  ctx.fillStyle = bg.skylineFar;
  for (const block of state.skyline) {
    const px = block.x - state.cameraX * 0.22;
    const py = WORLD.groundY - 52 - block.h * 0.72;
    const w = block.w * 1.08;
    if (px + w < -120 || px > WORLD.viewWidth + 120) continue;
    ctx.fillRect(px, py, w, block.h * 0.72);
  }

  // Near skyline layer
  ctx.fillStyle = bg.skylineNear;
  for (const block of state.skyline) {
    const px = block.x - state.cameraX * 0.35;
    const py = WORLD.groundY - 25 - block.h;
    if (px + block.w < -100 || px > WORLD.viewWidth + 100) continue;
    ctx.fillRect(px, py, block.w, block.h);
  }

  ctx.strokeStyle = bg.grid;
  for (let y = 0; y < WORLD.viewHeight; y += bg.gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WORLD.viewWidth, y + 0.5);
    ctx.stroke();
  }
}

function drawGround() {
  ctx.fillStyle = "#435a3b";
  ctx.fillRect(0, WORLD.groundY, WORLD.viewWidth, WORLD.viewHeight - WORLD.groundY);

  ctx.fillStyle = "rgba(10,18,14,0.45)";
  ctx.fillRect(0, WORLD.groundY + 42, WORLD.viewWidth, WORLD.viewHeight - WORLD.groundY - 42);

  const tile = WORLD.tileSize;
  const start = Math.floor(state.cameraX / tile) * tile;
  const end = state.cameraX + WORLD.viewWidth + tile;

  for (let x = start; x <= end; x += tile) {
    spriteSheet.draw(ctx, "ground_tile", 0, sx(x), WORLD.groundY - tile, tile, tile);
  }
}

function drawBuildings() {
  for (const b of state.buildings) {
    const bx = sx(b.x);
    if (bx + b.width < -40 || bx > WORLD.viewWidth + 40) continue;

    for (let row = 0; row < b.rows; row += 1) {
      for (let col = 0; col < b.cols; col += 1) {
        const x = bx + col * WORLD.tileSize;
        const y = b.yTop + row * WORLD.tileSize;
        const tileState = b.tiles[row][col];

        if (tileState >= 3) continue;

        if (row === 0) {
          spriteSheet.draw(ctx, "roof_tile", 0, x, y, WORLD.tileSize, WORLD.tileSize);
          continue;
        }

        const crowd = state.civilians;
        if (crowd) {
          const occupant = crowd.windowMap.get(windowKey(b.id, row, col));
          if (occupant && occupant.visible) {
            drawWindowCivilian(x, y, occupant);
          }
        }

        const spriteName = tileState === 0
          ? "window_full"
          : tileState === 1
            ? "window_cracked"
            : tileState === 2
              ? "window_broken"
              : "window_hole";

        spriteSheet.draw(ctx, spriteName, 0, x, y, WORLD.tileSize, WORLD.tileSize);
      }
    }

  }
}

function drawCivilians() {
  const crowd = state.civilians;
  if (!crowd) return;

  for (const c of crowd.roof) {
    const y = c.building.yTop - 2;
    const alpha = c.dying > 0 ? clamp(c.dying / 0.38, 0, 1) : 1;
    drawCitizen(sx(c.x), y, 1.02, c.tint, c.panic > 0, c.phase + state.time * 7, c.hurtTimer > 0 || c.dying > 0, alpha);
  }

  for (const c of crowd.street) {
    const y = WORLD.groundY - 2;
    const alpha = c.dying > 0 ? clamp(c.dying / 0.38, 0, 1) : 1;
    drawCitizen(sx(c.x), y, 1.08, c.tint, c.panic > 0, c.phase + state.time * 8, c.hurtTimer > 0 || c.dying > 0, alpha);
  }
}

function drawCivilianVehicles() {
  const vehicles = state.vehicles;
  if (!vehicles) return;

  const palettes = ["#2f5aa9", "#6f7179", "#3d8d62", "#9a5f34", "#7f458f"];
  for (const v of vehicles) {
    const x = sx(v.x);
    if (x < -70 || x > WORLD.viewWidth + 70) continue;

    const y = v.y - 6;
    const flashing = v.hitFlash > 0 && Math.floor(state.time * 28) % 2 === 0;
    const color = flashing ? "#ff5454" : palettes[v.tint % palettes.length];
    const winColor = flashing ? "#ffd4d4" : "#b9d4ec";

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, v.y + 5, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillRect(x - 20, y - 15, 40, 15);
    ctx.fillRect(x - 12, y - 23, 24, 10);

    ctx.fillStyle = winColor;
    ctx.fillRect(x - 9, y - 21, 8, 7);
    ctx.fillRect(x + 1, y - 21, 8, 7);

    ctx.fillStyle = "#1f252f";
    ctx.fillRect(x - 17, y - 1, 10, 5);
    ctx.fillRect(x + 7, y - 1, 10, 5);
  }
}

function drawWindowCivilian(tileX, tileY, occupant) {
  const cx = tileX + WORLD.tileSize * 0.5;
  const cy = tileY + WORLD.tileSize * 0.82;
  const sway = Math.sin(state.time * 2.8 + occupant.phase) * 0.7;
  const hurt = occupant.hurtTimer > 0 || occupant.dying > 0;
  const a = (occupant.panic > 0 ? 0.42 : 0.55) * (occupant.dying > 0 ? clamp(occupant.dying / 0.34, 0, 1) : 1);

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx + sway, cy);

  const body = hurt ? "#b23e3e" : occupant.tint % 2 === 0 ? "#17222b" : "#1f2a34";
  const head = hurt ? "#ff8e8e" : "#2f3f4c";

  ctx.fillStyle = body;
  ctx.fillRect(-3.5, -8.5, 7, 8);
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(0, -10.6, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCitizen(x, footY, scale, tint, panic, phase, hurt = false, alpha = 1) {
  if (x < -20 || x > WORLD.viewWidth + 20) return;

  const palettes = [
    { body: "#2b3f4a", head: "#d9b78b", accent: "#8ca2b0" },
    { body: "#3a2f4e", head: "#ddb88f", accent: "#9d90b6" },
    { body: "#42502b", head: "#d7ae82", accent: "#95ab78" },
    { body: "#4a2f2f", head: "#d8ad85", accent: "#b28787" },
    { body: "#2a4440", head: "#d8b18c", accent: "#7ba59d" },
  ];
  const p = palettes[tint % palettes.length];
  const bob = Math.sin(phase) * (panic ? 1.4 : 0.8) * scale;
  const leg = Math.sin(phase) * 1.4 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, footY + bob);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 4.8 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hurt ? "#a83232" : p.body;
  ctx.fillRect(-3 * scale, -10 * scale, 6 * scale, 8 * scale);

  ctx.fillStyle = hurt ? "#ff8f8f" : p.accent;
  ctx.fillRect(-2 * scale, -9 * scale, 1.2 * scale, 6 * scale);
  ctx.fillRect(0.8 * scale, -9 * scale, 1.2 * scale, 6 * scale);

  ctx.fillStyle = hurt ? "#ffd1d1" : p.head;
  ctx.beginPath();
  ctx.arc(0, -12.2 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hurt ? "#a83232" : p.body;
  ctx.fillRect(-2.2 * scale + leg, -2.4 * scale, 1.8 * scale, 4.6 * scale);
  ctx.fillRect(0.4 * scale - leg, -2.4 * scale, 1.8 * scale, 4.6 * scale);

  ctx.restore();
}

function drawFallingTiles() {
  for (const block of state.fallingTiles) {
    const x = sx(block.x);
    if (x < -80 || x > WORLD.viewWidth + 80) continue;

    spriteSheet.draw(
      ctx,
      block.sprite,
      0,
      x,
      block.y,
      WORLD.tileSize,
      WORLD.tileSize,
      {
        rotation: block.rot,
        alpha: block.alpha,
      },
    );
  }
}

function drawTanks() {
  for (const tank of state.tanks) {
    const x = sx(tank.x);
    if (x < -120 || x > WORLD.viewWidth + 120) continue;

    const shooting = tank.shootCooldown < 0.2 && spriteAtlas.getCount("tank_shoot") > 0;
    const animName = shooting ? "tank_shoot" : "tank_move";
    const frame = shooting ? 0 : Math.floor(tank.animTime * 5) % Math.max(1, spriteAtlas.getCount("tank_move"));

    spriteSheet.draw(ctx, animName, frame, x - 49, tank.y - 56, 98, 56, { flipX: tank.dir < 0 });

    if (tank.flash > 0) {
      const mx = x + tank.dir * 22;
      const my = tank.y - 34;
      const glow = ctx.createRadialGradient(mx, my, 2, mx, my, 18);
      glow.addColorStop(0, "rgba(255,230,120,0.95)");
      glow.addColorStop(1, "rgba(255,180,60,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBoss() {
  const boss = state.boss;
  if (!boss) return;

  const x = sx(boss.x);
  if (x < -220 || x > WORLD.viewWidth + 220) return;

  const loaded = bossImage.complete && bossImage.naturalWidth > 0;
  const alphaPulse = boss.hitFlash > 0 ? (Math.floor(state.time * 34) % 2 === 0 ? 0.65 : 1) : 1;

  ctx.save();
  ctx.globalAlpha = alphaPulse;

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, boss.y + 5, boss.w * 0.42, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (loaded) {
    const dx = x - boss.w * 0.5;
    const dy = boss.y - boss.h;

    if (boss.dir < 0) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }

    ctx.drawImage(
      bossImage,
      BOSS_SPRITE.sx,
      BOSS_SPRITE.sy,
      BOSS_SPRITE.sw,
      BOSS_SPRITE.sh,
      dx,
      dy,
      boss.w,
      boss.h,
    );
  } else {
    ctx.fillStyle = "#3f7f4a";
    ctx.fillRect(x - boss.w * 0.45, boss.y - boss.h * 0.92, boss.w * 0.9, boss.h * 0.9);
  }

  if (boss.flash > 0) {
    const mx = x + boss.dir * boss.w * 0.36;
    const my = boss.y - boss.h * 0.69;
    const flare = ctx.createRadialGradient(mx, my, 2, mx, my, 26);
    flare.addColorStop(0, "rgba(255, 220, 120, 0.95)");
    flare.addColorStop(1, "rgba(255, 180, 70, 0)");
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  const barW = 160;
  const barH = 11;
  const hpRatio = clamp(boss.hp / boss.maxHp, 0, 1);
  const bx = x - barW * 0.5;
  const by = boss.y - boss.h - 20;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
  ctx.fillStyle = "#2a2020";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = "#ff5c5c";
  ctx.fillRect(bx, by, barW * hpRatio, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.strokeRect(bx, by, barW, barH);
}

function drawTankBullets() {
  for (const shot of state.tankBullets) {
    const x = sx(shot.x);
    const px = sx(shot.px);
    const angle = Math.atan2(shot.vy, shot.vx);
    const isBoss = shot.kind === "boss";
    const trailColor = isBoss ? "rgba(255, 105, 85, 0.95)" : "rgba(255, 170, 70, 0.95)";
    const trailSize = isBoss ? 4.6 : 3;
    const glowRadius = isBoss ? 20 : 14;
    const spriteW = isBoss ? 42 : 34;
    const spriteH = isBoss ? 20 : 16;
    const glowOuter = isBoss ? "rgba(255, 80, 65, 0)" : "rgba(255, 170, 70, 0)";
    const glowInner = isBoss ? "rgba(255, 218, 190, 0.98)" : "rgba(255, 240, 170, 0.95)";

    // Tracer line for readability
    const grad = ctx.createLinearGradient(px, shot.py, x, shot.y);
    grad.addColorStop(0, "rgba(255, 220, 110, 0)");
    grad.addColorStop(1, trailColor);
    ctx.strokeStyle = grad;
    ctx.lineWidth = trailSize;
    ctx.beginPath();
    ctx.moveTo(px, shot.py);
    ctx.lineTo(x, shot.y);
    ctx.stroke();

    // Glow core
    const glow = ctx.createRadialGradient(x, shot.y, 2, x, shot.y, glowRadius);
    glow.addColorStop(0, glowInner);
    glow.addColorStop(1, glowOuter);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, shot.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sprite shell
    spriteSheet.draw(ctx, "bullet", 0, x - spriteW * 0.5, shot.y - spriteH * 0.5, spriteW, spriteH, { rotation: angle });
  }
}

function drawBombs() {
  for (const b of state.bombs) {
    const x = sx(b.x);

    const glow = ctx.createRadialGradient(x, b.y, 2, x, b.y, 14);
    glow.addColorStop(0, "rgba(172, 235, 255, 0.95)");
    glow.addColorStop(1, "rgba(92, 190, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, b.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#9ee8ff";
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#dfffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawUfo() {
  const ufo = state.ufo;
  const x = sx(ufo.x);
  const y = ufo.y;
  const loaded = ufoImage.complete && ufoImage.naturalWidth > 0;
  const wobble = Math.sin(state.time * 6) * 1.6;
  const drawY = y + wobble;

  ctx.save();
  if (ufo.invuln > 0 && Math.floor(state.time * 30) % 2 === 0) {
    ctx.globalAlpha = 0.58;
  }

  if (ufo.hitFlash > 0) {
    const glow = ctx.createRadialGradient(x, drawY - 4, 16, x, drawY - 4, 66);
    glow.addColorStop(0, "rgba(255, 120, 120, 0.4)");
    glow.addColorStop(1, "rgba(255, 120, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, drawY - 4, 66, 0, Math.PI * 2);
    ctx.fill();
  }

  if (loaded) {
    ctx.drawImage(
      ufoImage,
      UFO_SPRITE.sx,
      UFO_SPRITE.sy,
      UFO_SPRITE.sw,
      UFO_SPRITE.sh,
      x - ufo.w * 0.5,
      drawY - ufo.h * 0.57,
      ufo.w,
      ufo.h,
    );
  } else {
    // fallback if assets/ufo.png is missing
    ctx.fillStyle = "#9ea9b4";
    ctx.beginPath();
    ctx.ellipse(x, drawY, ufo.w * 0.45, ufo.h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawDamageOverlay() {
  const flash = clamp(state.ufo.hitFlash / 0.34, 0, 1);
  if (flash <= 0) return;

  // Full screen hit flash
  ctx.fillStyle = `rgba(255, 70, 70, ${0.18 * flash})`;
  ctx.fillRect(0, 0, WORLD.viewWidth, WORLD.viewHeight);

  // Red border pulse
  ctx.strokeStyle = `rgba(255, 120, 120, ${0.72 * flash})`;
  ctx.lineWidth = 10 * flash + 2;
  ctx.strokeRect(0, 0, WORLD.viewWidth, WORLD.viewHeight);
}

function drawParticles() {
  for (const p of state.particles) {
    const x = sx(p.x);
    const lifeRatio = clamp(p.life / p.maxLife, 0, 1);
    const size = 8 + 14 * lifeRatio;

    spriteSheet.draw(
      ctx,
      "debris",
      0,
      x - size * 0.5,
      p.y - size * 0.5,
      size,
      size,
      {
        alpha: lifeRatio,
        rotation: p.angle,
      },
    );
  }
}

function drawFx() {
  for (const fx of state.fx) {
    const x = sx(fx.x);
    const t = clamp(fx.t / fx.life, 0, 0.999);

    if (fx.type === "explosion") {
      const count = Math.max(1, spriteAtlas.getCount("explosion"));
      const frame = Math.floor(t * count);
      const size = 88 * fx.scale;
      spriteSheet.draw(ctx, "explosion", frame, x - size * 0.5, fx.y - size * 0.5, size, size);
    } else {
      const size = 64 * fx.scale;
      spriteSheet.draw(ctx, "impact", 0, x - size * 0.5, fx.y - size * 0.5, size, size);
    }
  }
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.56)";
  ctx.fillRect(0, 0, WORLD.viewWidth, WORLD.viewHeight);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe8a6";
  ctx.font = "bold 62px Trebuchet MS, sans-serif";
  ctx.fillText("UFO DOWN", WORLD.viewWidth * 0.5, WORLD.viewHeight * 0.42);

  ctx.fillStyle = "#f6f8ff";
  ctx.font = "bold 28px Trebuchet MS, sans-serif";
  ctx.fillText(`Score: ${Math.floor(state.score)}`, WORLD.viewWidth * 0.5, WORLD.viewHeight * 0.52);

  ctx.fillStyle = "#9ed8ff";
  ctx.font = "bold 24px Trebuchet MS, sans-serif";
  ctx.fillText("Press R to Restart", WORLD.viewWidth * 0.5, WORLD.viewHeight * 0.6);
}

function drawPaused() {
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, WORLD.viewWidth, WORLD.viewHeight);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8f6ff";
  ctx.font = "bold 56px Trebuchet MS, sans-serif";
  ctx.fillText("PAUSED", WORLD.viewWidth * 0.5, WORLD.viewHeight * 0.46);

  ctx.fillStyle = "#9ed8ff";
  ctx.font = "bold 24px Trebuchet MS, sans-serif";
  ctx.fillText("Press P, Esc, or click Pause to resume", WORLD.viewWidth * 0.5, WORLD.viewHeight * 0.54);
}

function refreshDebugEntries() {
  debug.entries = spriteAtlas.getEntries();
  debug.selected = clamp(debug.selected, 0, Math.max(0, debug.entries.length - 1));
}

function updateDebugAtlasEditor() {
  refreshDebugEntries();
  if (debug.entries.length === 0) return;

  if (keyPressed("BracketRight")) debug.selected = (debug.selected + 1) % debug.entries.length;
  if (keyPressed("BracketLeft")) debug.selected = (debug.selected - 1 + debug.entries.length) % debug.entries.length;

  const item = debug.entries[debug.selected];
  if (!item) return;

  const r = item.frame;
  const step = keyDown("AltLeft") || keyDown("AltRight") ? 10 : 1;
  const resizing = keyDown("ShiftLeft") || keyDown("ShiftRight");

  if (keyPressed("ArrowLeft")) {
    if (resizing) r.sw = Math.max(1, r.sw - step);
    else r.sx = Math.max(0, r.sx - step);
  }
  if (keyPressed("ArrowRight")) {
    if (resizing) r.sw = Math.max(1, r.sw + step);
    else r.sx += step;
  }
  if (keyPressed("ArrowUp")) {
    if (resizing) r.sh = Math.max(1, r.sh - step);
    else r.sy = Math.max(0, r.sy - step);
  }
  if (keyPressed("ArrowDown")) {
    if (resizing) r.sh = Math.max(1, r.sh + step);
    else r.sy += step;
  }

  if (keyPressed("KeyP")) {
    console.log("ATLAS:", JSON.stringify(ATLAS, null, 2));
  }
}

function drawDebugAtlasOverlay() {
  const sw = spriteImage.naturalWidth || 1536;
  const sh = spriteImage.naturalHeight || 1024;

  const maxW = WORLD.viewWidth * 0.38;
  const scale = Math.min(0.32, maxW / sw);

  const w = sw * scale;
  const h = sh * scale;

  const x = WORLD.viewWidth - w - 18;
  const y = 18;

  ctx.fillStyle = "rgba(8,10,16,0.78)";
  ctx.fillRect(x - 12, y - 12, w + 24, h + 124);

  const loaded = spriteImage.complete && spriteImage.naturalWidth > 0;
  if (loaded) {
    ctx.drawImage(spriteImage, x, y, w, h);
  } else {
    ctx.fillStyle = "#263647";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9ed8ff";
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.fillText("Waiting for assets/sprites.png", x + 10, y + 24);
  }

  for (let i = 0; i < debug.entries.length; i += 1) {
    const e = debug.entries[i];
    const r = e.frame;

    ctx.lineWidth = i === debug.selected ? 2 : 1;
    ctx.strokeStyle = i === debug.selected ? "#ffd86e" : "rgba(87,234,255,0.6)";
    ctx.strokeRect(x + r.sx * scale, y + r.sy * scale, r.sw * scale, r.sh * scale);
  }

  const selected = debug.entries[debug.selected];
  if (selected) {
    const r = selected.frame;

    ctx.textAlign = "left";
    ctx.fillStyle = "#e8f7ff";
    ctx.font = "15px Trebuchet MS, sans-serif";
    ctx.fillText(
      `Selected: ${selected.name}[${selected.frameIndex}] sx:${r.sx} sy:${r.sy} sw:${r.sw} sh:${r.sh}`,
      x,
      y + h + 24,
    );

    ctx.fillStyle = "#c8deed";
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillText("G toggle | [ ] entry | Arrows move | Shift+Arrows resize | Alt x10 | P print", x, y + h + 48);
    ctx.fillText("Gameplay pauses while debug overlay is active.", x, y + h + 68);
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  draw();
  clearPressed();

  requestAnimationFrame(loop);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function shouldUseMobileViewport() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches && window.innerWidth <= 900;
}

function applyViewportProfile() {
  const vp = shouldUseMobileViewport() ? VIEWPORTS.mobile : VIEWPORTS.desktop;
  if (canvas.width === vp.width && canvas.height === vp.height) return;

  canvas.width = vp.width;
  canvas.height = vp.height;
  WORLD.viewWidth = vp.width;
  WORLD.viewHeight = vp.height;

  if (state) {
    state.cameraX = clamp(state.cameraX, 0, Math.max(0, WORLD.width - WORLD.viewWidth));
    if (state.ufo) {
      state.ufo.y = clamp(state.ufo.y, Math.max(72, state.ufo.h * 0.55), WORLD.groundY - 120);
    }
  }
}

function setVirtualKey(code, down) {
  input.down[code] = !!down;
  if (down) input.pressed[code] = true;
}

function setStickVisual(dx, dy) {
  if (!mbStickKnob) return;
  mbStickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetStick() {
  mobileStick.active = false;
  mobileStick.x = 0;
  mobileStick.y = 0;
  setStickVisual(0, 0);
}

function bindVirtualStick(zone, knob) {
  if (!zone || !knob) return;
  let activePointerId = null;

  const updateFromPointer = (clientX, clientY) => {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = Math.max(24, rect.width * 0.32);
    const mag = Math.hypot(dx, dy);
    const clampedMag = Math.min(radius, mag);
    const inv = mag > 0.0001 ? 1 / mag : 0;
    const px = dx * inv * clampedMag;
    const py = dy * inv * clampedMag;

    mobileStick.active = true;
    mobileStick.x = clamp(px / radius, -1, 1);
    mobileStick.y = clamp(py / radius, -1, 1);
    setStickVisual(px, py);
  };

  const onStart = (ev) => {
    if (activePointerId != null) return;
    activePointerId = ev.pointerId;
    if (typeof zone.setPointerCapture === "function") {
      try {
        zone.setPointerCapture(ev.pointerId);
      } catch {
        // ignore capture failures
      }
    }
    ev.preventDefault();
    unlockAudio();
    updateFromPointer(ev.clientX, ev.clientY);
  };

  const onMove = (ev) => {
    if (ev.pointerId !== activePointerId) return;
    ev.preventDefault();
    updateFromPointer(ev.clientX, ev.clientY);
  };

  const onEnd = (ev) => {
    if (activePointerId != null && ev.pointerId !== activePointerId) return;
    activePointerId = null;
    ev.preventDefault();
    resetStick();
  };

  zone.addEventListener("pointerdown", onStart);
  zone.addEventListener("pointermove", onMove);
  zone.addEventListener("pointerup", onEnd);
  zone.addEventListener("pointercancel", onEnd);
  zone.addEventListener("pointerleave", onEnd);
  zone.addEventListener("lostpointercapture", onEnd);
}

function bindVirtualHold(button, code) {
  if (!button) return;
  let activePointerId = null;

  const onStart = (ev) => {
    if (activePointerId != null) return;
    activePointerId = ev.pointerId;
    if (typeof button.setPointerCapture === "function") {
      try {
        button.setPointerCapture(ev.pointerId);
      } catch {
        // ignore capture failures
      }
    }
    ev.preventDefault();
    unlockAudio();
    setVirtualKey(code, true);
    button.classList.add("is-active");
  };

  const onEnd = (ev) => {
    if (activePointerId != null && ev.pointerId !== activePointerId) return;
    activePointerId = null;
    ev.preventDefault();
    setVirtualKey(code, false);
    button.classList.remove("is-active");
  };

  button.addEventListener("pointerdown", onStart);
  button.addEventListener("pointerup", onEnd);
  button.addEventListener("pointercancel", onEnd);
  button.addEventListener("pointerleave", onEnd);
  button.addEventListener("lostpointercapture", onEnd);
}

function resetVirtualInputs() {
  setVirtualKey("Space", false);
  resetStick();
}

function bindMobileControls() {
  bindVirtualStick(mbStickZone, mbStickKnob);
  bindVirtualHold(mbFire, "Space");

  window.addEventListener("blur", resetVirtualInputs);
}

const preventDefaultKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Escape",
  "Space",
  "BracketLeft",
  "BracketRight",
]);

window.addEventListener("keydown", (ev) => {
  if (preventDefaultKeys.has(ev.code)) ev.preventDefault();
  unlockAudio();

  input.down[ev.code] = true;
  input.pressed[ev.code] = true;

  if (ev.code === "KeyG" && !ev.repeat) {
    debug.enabled = !debug.enabled;
  }

  if (ev.code === "KeyM" && !ev.repeat) {
    setMuted(!AUDIO.muted);
  }

  if ((ev.code === "KeyP" || ev.code === "Escape") && !ev.repeat) {
    togglePause();
  }

  if (ev.code === "KeyN" && !ev.repeat) {
    startNextCity();
  }

  if ((ev.code === "KeyR" || ev.code === "Enter") && state && state.gameOver && !ev.repeat) {
    resetGame();
  }
});

if (nextCityButton) {
  nextCityButton.addEventListener("click", () => {
    unlockAudio();
    startNextCity();
  });
}

if (pauseButton) {
  pauseButton.addEventListener("click", () => {
    unlockAudio();
    togglePause();
  });
}

window.addEventListener("keyup", (ev) => {
  input.down[ev.code] = false;
});

window.addEventListener("resize", applyViewportProfile);
window.addEventListener("orientationchange", applyViewportProfile);

bindMobileControls();
applyViewportProfile();
resetGame();
requestAnimationFrame(loop);

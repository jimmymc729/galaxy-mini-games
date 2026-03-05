(function () {
  'use strict';

  // TODO: Add unlockable organism skins and biome-specific visual variants.
  // TODO: Replace synthesized audio with authored ambient and SFX assets.

  const CONFIG = {
    world: {
      width: 3600,
      height: 2400,
      margin: 40
    },
    simulation: {
      step: 1 / 60,
      maxFrame: 0.1,
      fpsSmoothing: 0.05
    },
    player: {
      startMass: 26,
      startSegments: 22,
      headRadius: 10,
      baseSpeed: 168,
      baseTurnRate: 10.9,
      minTurnRate: 5.8,
      turnMassFactor: 0.0032,
      boostTurnPenalty: 0.92,
      boostMultiplier: 1.52,
      boostDrain: 3.6,
      minBoostMass: 14,
      segmentSpacing: 8.6,
      minSegments: 12,
      massToSegment: 0.85,
      spawnProtection: 1.0
    },
    bots: {
      defaultCount: 12,
      minCount: 8,
      maxCount: 20,
      respawnMin: 1.2,
      respawnMax: 3.4,
      scanRadius: 300,
      avoidRadius: 110,
      dangerRadius: 150,
      boostCooldown: 1.8
    },
    collectibles: {
      minAmbient: 220,
      maxAmbient: 340,
      spawnBurst: 6,
      spawnInterval: 0.22,
      antiSnowballWeight: 0.55,
      nearMissDropCount: 2,
      nearMissCooldown: 0.8,
      comboWindow: 1.6,
      comboStep: 0.08,
      comboMaxBonus: 0.72,
      types: {
        glucose: { radius: 5.4, mass: 1.25, score: 11, color: '#8bf3d1', glow: '#4cc7bf', weight: 0.42 },
        amino: { radius: 7.3, mass: 2.9, score: 22, color: '#ffc89c', glow: '#ff9b78', weight: 0.19 },
        atp: { radius: 4.2, mass: 0.62, score: 6, color: '#9ec8ff', glow: '#77a7ef', weight: 0.39 },
        nutrient: { radius: 3.8, mass: 0.44, score: 5, color: '#b8ffeb', glow: '#88d9de', weight: 0 }
      }
    },
    hazards: {
      obstacles: 18,
      toxicPatches: 12,
      viscosityZones: 8,
      obstacleRadius: [38, 72],
      toxicRadius: [30, 58],
      viscosityRadius: [55, 92]
    },
    collisions: {
      bodyIgnoreSegments: 8,
      nearMissBand: 10,
      collectibleRange: 24
    },
    spawn: {
      organismClearance: 220,
      headClearance: 180,
      attempts: 120
    },
    rendering: {
      backgroundDots: 160,
      backgroundClouds: 20,
      groundDetails: 180,
      canopyRays: 7,
      ambientMotes: 80,
      maxParticles: 900,
      particleSpawnCollect: 8,
      particleSpawnDeath: 42,
      shadowBlurHigh: 16,
      shadowBlurLow: 5,
      adaptiveEntityLowThreshold: 900
    },
    camera: {
      followSmoothing: 0.1,
      zoom: 1
    }
  };
  const WORLD_WIDTH = CONFIG.world.width;
  const WORLD_HEIGHT = CONFIG.world.height;
  const HALF_WORLD_WIDTH = WORLD_WIDTH * 0.5;
  const HALF_WORLD_HEIGHT = WORLD_HEIGHT * 0.5;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function wrapCoordinate(value, max) {
    if (value < 0) {
      return value + max;
    }
    if (value >= max) {
      return value - max;
    }
    return value;
  }

  function wrappedDeltaX(a, b) {
    let delta = a - b;
    if (delta > HALF_WORLD_WIDTH) {
      delta -= WORLD_WIDTH;
    } else if (delta < -HALF_WORLD_WIDTH) {
      delta += WORLD_WIDTH;
    }
    return delta;
  }

  function wrappedDeltaY(a, b) {
    let delta = a - b;
    if (delta > HALF_WORLD_HEIGHT) {
      delta -= WORLD_HEIGHT;
    } else if (delta < -HALF_WORLD_HEIGHT) {
      delta += WORLD_HEIGHT;
    }
    return delta;
  }

  function sqrDistance(aX, aY, bX, bY) {
    const dx = wrappedDeltaX(aX, bX);
    const dy = wrappedDeltaY(aY, bY);
    return dx * dx + dy * dy;
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) {
      angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
      angle += Math.PI * 2;
    }
    return angle;
  }

  class SpatialHash {
    constructor(cellSize) {
      this.cellSize = cellSize;
      this.map = new Map();
      this.queryStamp = 1;
    }

    clear() {
      this.map.clear();
    }

    key(x, y) {
      return x + ',' + y;
    }

    insert(item, x, y, radius) {
      const r = radius || 0;
      const minX = Math.floor((x - r) / this.cellSize);
      const maxX = Math.floor((x + r) / this.cellSize);
      const minY = Math.floor((y - r) / this.cellSize);
      const maxY = Math.floor((y + r) / this.cellSize);

      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        for (let cellY = minY; cellY <= maxY; cellY += 1) {
          const key = this.key(cellX, cellY);
          let bucket = this.map.get(key);
          if (!bucket) {
            bucket = [];
            this.map.set(key, bucket);
          }
          bucket.push(item);
        }
      }
    }

    queryRange(centerX, centerY, radius, stamp, out) {
      const minX = Math.floor((centerX - radius) / this.cellSize);
      const maxX = Math.floor((centerX + radius) / this.cellSize);
      const minY = Math.floor((centerY - radius) / this.cellSize);
      const maxY = Math.floor((centerY + radius) / this.cellSize);

      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        for (let cellY = minY; cellY <= maxY; cellY += 1) {
          const bucket = this.map.get(this.key(cellX, cellY));
          if (!bucket) {
            continue;
          }

          for (let i = 0; i < bucket.length; i += 1) {
            const item = bucket[i];
            if (item._queryStamp === stamp) {
              continue;
            }
            item._queryStamp = stamp;
            out.push(item);
          }
        }
      }
    }

    queryCircle(x, y, radius, out) {
      out.length = 0;
      const stamp = this.queryStamp++;
      const wrapLeft = x - radius < 0;
      const wrapRight = x + radius > WORLD_WIDTH;
      const wrapTop = y - radius < 0;
      const wrapBottom = y + radius > WORLD_HEIGHT;

      this.queryRange(x, y, radius, stamp, out);

      if (wrapLeft) {
        this.queryRange(x + WORLD_WIDTH, y, radius, stamp, out);
      }
      if (wrapRight) {
        this.queryRange(x - WORLD_WIDTH, y, radius, stamp, out);
      }
      if (wrapTop) {
        this.queryRange(x, y + WORLD_HEIGHT, radius, stamp, out);
      }
      if (wrapBottom) {
        this.queryRange(x, y - WORLD_HEIGHT, radius, stamp, out);
      }
      if (wrapLeft && wrapTop) {
        this.queryRange(x + WORLD_WIDTH, y + WORLD_HEIGHT, radius, stamp, out);
      }
      if (wrapLeft && wrapBottom) {
        this.queryRange(x + WORLD_WIDTH, y - WORLD_HEIGHT, radius, stamp, out);
      }
      if (wrapRight && wrapTop) {
        this.queryRange(x - WORLD_WIDTH, y + WORLD_HEIGHT, radius, stamp, out);
      }
      if (wrapRight && wrapBottom) {
        this.queryRange(x - WORLD_WIDTH, y - WORLD_HEIGHT, radius, stamp, out);
      }

      return out;
    }
  }

  class Particle {
    constructor() {
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.life = 0;
      this.maxLife = 0;
      this.size = 0;
      this.color = '#ffffff';
      this.glow = '#ffffff';
    }
  }

  class ParticlePool {
    constructor(maxParticles) {
      this.pool = new Array(maxParticles);
      for (let i = 0; i < maxParticles; i += 1) {
        this.pool[i] = new Particle();
      }
      this.activeCount = 0;
    }

    spawn(x, y, vx, vy, life, size, color, glow) {
      for (let i = 0; i < this.pool.length; i += 1) {
        const particle = this.pool[i];
        if (particle.active) {
          continue;
        }
        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.vx = vx;
        particle.vy = vy;
        particle.life = life;
        particle.maxLife = life;
        particle.size = size;
        particle.color = color;
        particle.glow = glow;
        this.activeCount += 1;
        return particle;
      }
      return null;
    }

    update(dt) {
      for (let i = 0; i < this.pool.length; i += 1) {
        const particle = this.pool[i];
        if (!particle.active) {
          continue;
        }

        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          this.activeCount -= 1;
          continue;
        }

        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
    }

    draw(ctx, camera, quality, width, height) {
      const blur = quality === 'high' ? CONFIG.rendering.shadowBlurHigh : CONFIG.rendering.shadowBlurLow;

      for (let i = 0; i < this.pool.length; i += 1) {
        const particle = this.pool[i];
        if (!particle.active) {
          continue;
        }

        const alpha = particle.life / particle.maxLife;
        const sx = (particle.x - camera.x) * camera.zoom + width * 0.5;
        const sy = (particle.y - camera.y) * camera.zoom + height * 0.5;

        if (sx < -40 || sy < -40 || sx > width + 40 || sy > height + 40) {
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.glow;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        ctx.arc(sx, sy, particle.size * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  class Collectible {
    constructor(kind) {
      this.active = true;
      this.kind = kind;
      this.x = 0;
      this.y = 0;
      this.radius = 5;
      this.massValue = 0;
      this.scoreValue = 0;
      this.color = '#ffffff';
      this.glow = '#ffffff';
      this.ttl = -1;
      this.isDrop = false;
      this.fresh = false;
      this.spawnTime = 0;
      this.variant = 0;
      this.spin = 0;
      this.pulseRate = 0;
      this.orbit = 0;
      this.shape = 0;
      this._queryStamp = 0;
      this.configure(kind);
    }

    configure(kind) {
      const type = CONFIG.collectibles.types[kind] || CONFIG.collectibles.types.atp;
      this.kind = kind;
      this.radius = type.radius;
      this.massValue = type.mass;
      this.scoreValue = type.score;
      this.color = type.color;
      this.glow = type.glow;
    }

    randomizeVisual() {
      this.variant = randInt(0, 2);
      this.spin = rand(0, Math.PI * 2);
      this.pulseRate = rand(3.8, 6.8);
      this.orbit = rand(0.16, 0.42);

      if (this.kind === 'glucose') {
        this.shape = this.variant;
      } else if (this.kind === 'amino') {
        this.shape = this.variant;
      } else if (this.kind === 'atp') {
        this.shape = this.variant;
      } else {
        this.shape = this.variant % 2;
      }
    }

    reset(kind, x, y, ttl, isDrop, spawnTime) {
      this.active = true;
      this.configure(kind);
      this.randomizeVisual();
      this.x = x;
      this.y = y;
      this.ttl = typeof ttl === 'number' ? ttl : -1;
      this.isDrop = Boolean(isDrop);
      this.fresh = Boolean(isDrop);
      this.spawnTime = spawnTime || 0;
    }
  }

  class Hazard {
    constructor(kind, x, y, radius) {
      this.kind = kind;
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.variant = randInt(0, 2);
      this.phase = rand(0, Math.PI * 2);
      this.rotation = rand(-Math.PI, Math.PI);
      this.wobble = rand(0.9, 1.35);
      this._queryStamp = 0;
    }

    isLethal() {
      return this.kind === 'debris' || this.kind === 'toxic';
    }
  }

  let organismIdCounter = 1;

  class Organism {
    constructor(config, isPlayer) {
      this.id = organismIdCounter++;
      this.isPlayer = Boolean(isPlayer);
      this.isBot = !isPlayer;
      this.config = config;
      this.segments = [];
      this.alive = true;
      this.respawnTimer = 0;
      this.invulnerableTimer = 0;
      this.mass = config.startMass;
      this.score = 0;
      this.comboCount = 0;
      this.comboMultiplier = 1;
      this.lastPickupTime = -999;
      this.angle = rand(-Math.PI, Math.PI);
      this.head = { x: 0, y: 0 };
      this.color = this.isPlayer ? '#98e8d8' : '#8dc2e8';
      this.glow = this.isPlayer ? '#73e3d2' : '#88b7ff';
      this.baseHue = this.isPlayer ? 164 : rand(174, 208);
      this.patternType = this.isPlayer ? 0 : randInt(1, 4);
      this.primaryStride = this.isPlayer ? 5 : randInt(6, 10);
      this.secondaryStride = this.isPlayer ? 9 : randInt(8, 14);
      this.luminanceOffset = this.isPlayer ? 3 : rand(-5, 4);
      this.saturationOffset = this.isPlayer ? 8 : rand(-8, 6);
      this.featurePhase = rand(0, Math.PI * 2);
      this.boosting = false;
      this.spawnAt(rand(180, CONFIG.world.width - 180), rand(180, CONFIG.world.height - 180));
    }

    spawnAt(x, y) {
      this.alive = true;
      this.respawnTimer = 0;
      this.invulnerableTimer = this.config.spawnProtection;
      this.mass = this.config.startMass;
      this.score = 0;
      this.comboCount = 0;
      this.comboMultiplier = 1;
      this.lastPickupTime = -999;
      this.head.x = x;
      this.head.y = y;
      this.angle = rand(-Math.PI, Math.PI);
      this.boosting = false;

      this.segments.length = 0;
      const startLength = this.config.startSegments;
      for (let i = 0; i < startLength; i += 1) {
        this.segments.push({
          x: wrapCoordinate(x - Math.cos(this.angle) * i * this.config.segmentSpacing, WORLD_WIDTH),
          y: wrapCoordinate(y - Math.sin(this.angle) * i * this.config.segmentSpacing, WORLD_HEIGHT),
          _owner: this,
          _index: i,
          _radius: this.segmentRadius(i),
          _queryStamp: 0
        });
      }
    }

    setDead(delay) {
      this.alive = false;
      this.respawnTimer = delay;
      this.boosting = false;
      this.invulnerableTimer = 0;
      this.comboCount = 0;
      this.comboMultiplier = 1;
    }

    segmentRadius(index) {
      const t = index / Math.max(1, this.segments.length - 1);
      const base = this.config.headRadius * (1 - t * 0.45);
      return Math.max(3.2, base);
    }

    desiredSegmentCount() {
      return Math.max(
        this.config.minSegments,
        Math.floor(this.config.startSegments + this.mass * this.config.massToSegment)
      );
    }

    applyGrowth(amount) {
      this.mass += amount;
    }

    updateCombo(gameTime) {
      if (!this.isPlayer) {
        return;
      }

      if (gameTime - this.lastPickupTime <= CONFIG.collectibles.comboWindow) {
        this.comboCount += 1;
      } else {
        this.comboCount = 1;
      }

      const bonus = Math.min(
        CONFIG.collectibles.comboMaxBonus,
        Math.max(0, this.comboCount - 1) * CONFIG.collectibles.comboStep
      );

      this.comboMultiplier = 1 + bonus;
      this.lastPickupTime = gameTime;
    }

    recordPickup(scoreBase, gameTime) {
      if (this.isPlayer) {
        this.updateCombo(gameTime);
        this.score += Math.round(scoreBase * this.comboMultiplier);
      }
    }

    applyDriftDecay(gameTime) {
      if (!this.isPlayer) {
        return;
      }

      if (gameTime - this.lastPickupTime > CONFIG.collectibles.comboWindow) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }

    updateMotion(dt, desiredAngle, wantsBoost, slowFactor) {
      if (!this.alive) {
        return;
      }

      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
      }

      const massTurnMultiplier = 1 / (1 + this.mass * this.config.turnMassFactor);
      let turnRate = Math.max(
        this.config.minTurnRate,
        this.config.baseTurnRate * massTurnMultiplier
      );
      if (typeof desiredAngle === 'number') {
        const delta = normalizeAngle(desiredAngle - this.angle);
        if (wantsBoost) {
          turnRate *= this.config.boostTurnPenalty;
        }
        const maxTurn = turnRate * dt;
        this.angle += clamp(delta, -maxTurn, maxTurn);
      }

      const heaviness = 1 / (1 + this.mass * 0.0042);
      let speed = this.config.baseSpeed * (0.56 + heaviness);

      const canBoost = wantsBoost && this.mass > this.config.minBoostMass;
      this.boosting = canBoost;

      if (canBoost) {
        speed *= this.config.boostMultiplier;
        this.mass = Math.max(this.config.minBoostMass * 0.9, this.mass - this.config.boostDrain * dt);
      }

      speed *= slowFactor;

      this.head.x += Math.cos(this.angle) * speed * dt;
      this.head.y += Math.sin(this.angle) * speed * dt;
      this.head.x = wrapCoordinate(this.head.x, WORLD_WIDTH);
      this.head.y = wrapCoordinate(this.head.y, WORLD_HEIGHT);

      this.syncSegmentCount();
      this.followHead();
    }

    syncSegmentCount() {
      const target = this.desiredSegmentCount();
      const tail = this.segments[this.segments.length - 1];

      while (this.segments.length < target) {
        this.segments.push({
          x: tail.x,
          y: tail.y,
          _owner: this,
          _index: this.segments.length,
          _radius: 4,
          _queryStamp: 0
        });
      }

      while (this.segments.length > target) {
        this.segments.pop();
      }
    }

    followHead() {
      if (!this.segments.length) {
        return;
      }

      this.segments[0].x = this.head.x;
      this.segments[0].y = this.head.y;

      const spacing = this.config.segmentSpacing;

      for (let i = 1; i < this.segments.length; i += 1) {
        const prev = this.segments[i - 1];
        const current = this.segments[i];

        const dx = wrappedDeltaX(prev.x, current.x);
        const dy = wrappedDeltaY(prev.y, current.y);
        const dist = Math.hypot(dx, dy) || 0.0001;
        const move = (dist - spacing) * 0.62;

        current.x = wrapCoordinate(current.x + (dx / dist) * move, WORLD_WIDTH);
        current.y = wrapCoordinate(current.y + (dy / dist) * move, WORLD_HEIGHT);
      }

      for (let i = 0; i < this.segments.length; i += 1) {
        this.segments[i]._index = i;
        this.segments[i]._radius = this.segmentRadius(i);
      }
    }
  }

  class BotOrganism extends Organism {
    constructor(config) {
      super(config, false);
      this.thinkCooldown = 0;
      this.targetX = this.head.x;
      this.targetY = this.head.y;
      this.targetWeight = 0;
      this.wantsBoost = false;
      this.boostCooldown = rand(0.8, CONFIG.bots.boostCooldown);
      this.personality = rand(0.85, 1.2);
      this.aiTier = Math.random() < 0.34 ? 'elite' : 'standard';
      this.intellect = this.aiTier === 'elite' ? rand(1.18, 1.45) : rand(0.88, 1.08);
      this.riskTolerance = this.aiTier === 'elite' ? rand(0.74, 1) : rand(0.94, 1.3);
      this.opportunism = this.aiTier === 'elite' ? rand(1.12, 1.44) : rand(0.86, 1.12);
      this.aggressionTimer = 0;
      this.aggressionCooldown = rand(4.5, 9.5);
    }
  }

  class InputSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.controlScheme = 'mouse';
      this.activeControl = 'mouse';
      this.mouseX = 0;
      this.mouseY = 0;
      this.hasMouse = false;
      this.lastKeyboardInput = -999;
      this.lastTouchInput = -999;
      this.mouseTakeoverDistanceSq = 16;
      this.mouseTakeoverDelay = 0.12;
      this.mouseSuppressionAfterTouch = 0.6;
      this.touchActive = false;
      this.touchX = 0;
      this.touchY = 0;
      this.primaryTouchId = null;
      this.primaryTouchSource = null;
      this.touchBoost = false;
      this.keys = {
        up: false,
        down: false,
        left: false,
        right: false,
        boost: false
      };
      this.pausePressed = false;

      this.bindEvents();
    }

    nowSeconds() {
      return performance.now() * 0.001;
    }

    steeringKeysDown() {
      return this.keys.up || this.keys.down || this.keys.left || this.keys.right;
    }

    findTouchById(touchList, touchId) {
      if (touchId === null || !touchList) {
        return null;
      }
      for (let i = 0; i < touchList.length; i += 1) {
        if (touchList[i].identifier === touchId) {
          return touchList[i];
        }
      }
      return null;
    }

    updateTouchPosition(touch) {
      if (!touch) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.touchX = touch.clientX - rect.left;
      this.touchY = touch.clientY - rect.top;
      this.lastTouchInput = this.nowSeconds();
      this.hasMouse = false;
    }

    updateTouchPositionFromClient(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this.touchX = clientX - rect.left;
      this.touchY = clientY - rect.top;
      this.lastTouchInput = this.nowSeconds();
      this.hasMouse = false;
    }

    setTouchBoost(active) {
      this.touchBoost = Boolean(active);
      if (this.touchBoost) {
        this.activeControl = 'touch';
      }
    }

    bindEvents() {
      window.addEventListener('mousemove', (event) => {
        if (this.nowSeconds() - this.lastTouchInput < this.mouseSuppressionAfterTouch) {
          return;
        }
        const rect = this.canvas.getBoundingClientRect();
        const nextX = event.clientX - rect.left;
        const nextY = event.clientY - rect.top;
        const dx = nextX - this.mouseX;
        const dy = nextY - this.mouseY;
        this.mouseX = nextX;
        this.mouseY = nextY;
        this.hasMouse = true;

        if (
          !this.steeringKeysDown() &&
          dx * dx + dy * dy >= this.mouseTakeoverDistanceSq &&
          this.nowSeconds() - this.lastKeyboardInput > this.mouseTakeoverDelay
        ) {
          this.activeControl = 'mouse';
        }
      });

      if (window.PointerEvent) {
        this.canvas.addEventListener(
          'pointerdown',
          (event) => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
              return;
            }
            if (this.primaryTouchId !== null && event.pointerId !== this.primaryTouchId) {
              return;
            }
            event.preventDefault();
            this.activeControl = 'touch';
            this.primaryTouchId = event.pointerId;
            this.primaryTouchSource = 'pointer';
            this.touchActive = true;
            this.updateTouchPositionFromClient(event.clientX, event.clientY);
            if (typeof this.canvas.setPointerCapture === 'function') {
              try {
                this.canvas.setPointerCapture(event.pointerId);
              } catch (error) {
                // Pointer capture can fail on some mobile browsers; ignore.
              }
            }
          },
          { passive: false }
        );

        const movePointerTouch = (event) => {
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            return;
          }
          if (this.primaryTouchId === null || event.pointerId !== this.primaryTouchId) {
            return;
          }
          event.preventDefault();
          this.activeControl = 'touch';
          this.touchActive = true;
          this.updateTouchPositionFromClient(event.clientX, event.clientY);
        };

        this.canvas.addEventListener('pointermove', movePointerTouch, { passive: false });
        window.addEventListener('pointermove', movePointerTouch, { passive: false });

        const endPointerTouch = (event) => {
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            return;
          }
          if (this.primaryTouchId !== null && event.pointerId !== this.primaryTouchId) {
            return;
          }
          this.primaryTouchId = null;
          this.primaryTouchSource = null;
          this.touchActive = false;
        };

        this.canvas.addEventListener('pointerup', endPointerTouch, { passive: true });
        this.canvas.addEventListener('pointercancel', endPointerTouch, { passive: true });
        window.addEventListener('pointerup', endPointerTouch, { passive: true });
        window.addEventListener('pointercancel', endPointerTouch, { passive: true });
      }

      window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const isSteeringKey =
          key === 'arrowup' ||
          key === 'w' ||
          key === 'arrowdown' ||
          key === 's' ||
          key === 'arrowleft' ||
          key === 'a' ||
          key === 'arrowright' ||
          key === 'd';
        const isMovementKey =
          isSteeringKey ||
          key === ' ';

        if (isMovementKey) {
          event.preventDefault();
        }
        if (isSteeringKey) {
          this.activeControl = 'keyboard';
          this.lastKeyboardInput = this.nowSeconds();
        }

        if (key === 'arrowup' || key === 'w') {
          this.keys.up = true;
        }
        if (key === 'arrowdown' || key === 's') {
          this.keys.down = true;
        }
        if (key === 'arrowleft' || key === 'a') {
          this.keys.left = true;
        }
        if (key === 'arrowright' || key === 'd') {
          this.keys.right = true;
        }
        if (key === ' ') {
          this.keys.boost = true;
        }
        if (key === 'escape') {
          this.pausePressed = true;
        }
      });

      window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (
          key === 'arrowup' ||
          key === 'w' ||
          key === 'arrowdown' ||
          key === 's' ||
          key === 'arrowleft' ||
          key === 'a' ||
          key === 'arrowright' ||
          key === 'd' ||
          key === ' '
        ) {
          event.preventDefault();
        }
        if (key === 'arrowup' || key === 'w') {
          this.keys.up = false;
        }
        if (key === 'arrowdown' || key === 's') {
          this.keys.down = false;
        }
        if (key === 'arrowleft' || key === 'a') {
          this.keys.left = false;
        }
        if (key === 'arrowright' || key === 'd') {
          this.keys.right = false;
        }
        if (key === ' ') {
          this.keys.boost = false;
        }
      });

      if (!window.PointerEvent) {
        this.canvas.addEventListener(
          'touchstart',
          (event) => {
            if (!event.touches.length) {
              return;
            }
            event.preventDefault();
            this.activeControl = 'touch';
            if (this.primaryTouchId === null) {
              const touch = event.changedTouches[0] || event.touches[0];
              if (!touch) {
                return;
              }
              this.primaryTouchId = touch.identifier;
              this.primaryTouchSource = 'touch';
              this.touchActive = true;
              this.updateTouchPosition(touch);
            } else {
              const touch = this.findTouchById(event.touches, this.primaryTouchId);
              if (!touch) {
                return;
              }
              this.touchActive = true;
              this.updateTouchPosition(touch);
            }
          },
          { passive: false }
        );

        const moveTouch = (event) => {
          if (this.primaryTouchId === null || this.primaryTouchSource !== 'touch') {
            return;
          }
          const touch = this.findTouchById(event.touches, this.primaryTouchId);
          if (!touch) {
            return;
          }
          event.preventDefault();
          this.activeControl = 'touch';
          this.touchActive = true;
          this.updateTouchPosition(touch);
        };

        this.canvas.addEventListener('touchmove', moveTouch, { passive: false });
        window.addEventListener('touchmove', moveTouch, { passive: false });

        const clearTouch = (event) => {
          if (this.primaryTouchId === null || this.primaryTouchSource !== 'touch') {
            return;
          }
          const stillActiveTouch = this.findTouchById(event.touches, this.primaryTouchId);
          if (stillActiveTouch) {
            this.touchActive = true;
            this.updateTouchPosition(stillActiveTouch);
            return;
          }
          this.primaryTouchId = null;
          this.primaryTouchSource = null;
          this.touchActive = false;
        };

        window.addEventListener('touchend', clearTouch, { passive: true });
        window.addEventListener('touchcancel', clearTouch, { passive: true });
      }
    }

    consumePausePressed() {
      const value = this.pausePressed;
      this.pausePressed = false;
      return value;
    }

    setControlScheme(scheme) {
      this.controlScheme = scheme === 'keyboard' ? 'keyboard' : 'mouse';
      this.activeControl = this.controlScheme;
    }

    getIntent(player, camera, viewport) {
      let desiredAngle = player.angle;
      let hasDirection = false;
      const xAxis = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      const yAxis = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
      const keyboardActive = xAxis !== 0 || yAxis !== 0;
      const preferKeyboard = this.activeControl === 'keyboard';

      // Keyboard uses relative steering so movement feels smooth at all sizes.
      if (preferKeyboard && keyboardActive) {
        if (xAxis !== 0) {
          desiredAngle = player.angle + xAxis * 0.72;
          hasDirection = true;
        } else if (yAxis !== 0) {
          desiredAngle = player.angle + yAxis * 0.3;
          hasDirection = true;
        }
      } else if (this.activeControl === 'touch' && this.touchActive) {
        const worldX = (this.touchX - viewport.width * 0.5) / camera.zoom + camera.x;
        const worldY = (this.touchY - viewport.height * 0.5) / camera.zoom + camera.y;
        desiredAngle = Math.atan2(worldY - player.head.y, worldX - player.head.x);
        hasDirection = true;
      } else if (this.activeControl === 'mouse' && this.hasMouse) {
        const worldX = (this.mouseX - viewport.width * 0.5) / camera.zoom + camera.x;
        const worldY = (this.mouseY - viewport.height * 0.5) / camera.zoom + camera.y;
        desiredAngle = Math.atan2(worldY - player.head.y, worldX - player.head.x);
        hasDirection = true;
      }

      return {
        desiredAngle: hasDirection ? desiredAngle : player.angle,
        boost: this.keys.boost || this.touchBoost
      };
    }
  }

  class AudioSystem {
    constructor() {
      this.context = null;
      this.masterGain = null;
      this.ambientNodes = null;
      this.muted = false;
      this.masterVolume = 0.19;
      this.lastCollectTime = 0;
      this.lastNearMissTime = 0;
      this.lastComboTime = 0;
      this.lastBoostPulseTime = 0;
      this.lastUiTime = 0;
      this.lastHazardWarningTime = 0;
      this.lastViscosityCueTime = 0;
    }

    ensureContext() {
      if (this.context) {
        return;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.context.destination);
    }

    unlock() {
      this.ensureContext();
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().catch(() => {
          // Audio resume can fail before user activation; retry later.
        });
      }
      // Intentional: no always-on ambient loop; keep audio event-driven.
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      this.ensureContext();
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(
          this.muted ? 0 : this.masterVolume,
          this.context.currentTime,
          0.02
        );
      }
    }

    startAmbient() {
      if (!this.context || !this.masterGain || this.ambientNodes) {
        return;
      }

      const low = this.context.createOscillator();
      const high = this.context.createOscillator();
      const ambientGain = this.context.createGain();
      const wobble = this.context.createGain();
      const lfo = this.context.createOscillator();

      low.type = 'sine';
      high.type = 'triangle';
      low.frequency.value = 52;
      high.frequency.value = 91;

      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      wobble.gain.value = 4;
      ambientGain.gain.value = 0.17;

      lfo.connect(wobble);
      wobble.connect(high.frequency);

      low.connect(ambientGain);
      high.connect(ambientGain);
      ambientGain.connect(this.masterGain);

      low.start();
      high.start();
      lfo.start();

      this.ambientNodes = { low, high, lfo, ambientGain, wobble };
    }

    canPlay() {
      return Boolean(this.context && this.masterGain && !this.muted);
    }

    playUi(kind) {
      this.ensureContext();
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().catch(() => {
          // Resume can fail until user activation; next input retries.
        });
      }

      if (!this.context || !this.masterGain) {
        return;
      }

      const now = this.context.currentTime;
      if (now - this.lastUiTime < 0.03) {
        return;
      }
      this.lastUiTime = now;

      if (this.muted) {
        return;
      }

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const shimmer = this.context.createOscillator();
      const shimmerGain = this.context.createGain();

      osc.type = 'triangle';
      shimmer.type = 'sine';

      if (kind === 'start') {
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
        shimmer.frequency.setValueAtTime(760, now);
        shimmer.frequency.exponentialRampToValueAtTime(980, now + 0.12);
      } else if (kind === 'close') {
        osc.frequency.setValueAtTime(390, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        shimmer.frequency.setValueAtTime(700, now);
        shimmer.frequency.exponentialRampToValueAtTime(540, now + 0.1);
      } else {
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(430, now + 0.08);
        shimmer.frequency.setValueAtTime(660, now);
        shimmer.frequency.exponentialRampToValueAtTime(820, now + 0.08);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      shimmerGain.gain.setValueAtTime(0.001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.015, now + 0.01);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      shimmer.connect(shimmerGain);
      gain.connect(this.masterGain);
      shimmerGain.connect(this.masterGain);

      osc.start(now);
      shimmer.start(now);
      osc.stop(now + 0.13);
      shimmer.stop(now + 0.12);
    }

    playCollect(kind, comboMultiplier) {
      if (!this.context || !this.masterGain || this.muted) {
        return;
      }

      const now = this.context.currentTime;
      if (now - this.lastCollectTime < 0.02) {
        return;
      }
      this.lastCollectTime = now;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const accent = this.context.createOscillator();
      const accentGain = this.context.createGain();
      osc.type = 'triangle';
      accent.type = 'sine';

      if (kind === 'amino') {
        osc.frequency.value = 490;
        accent.frequency.value = 760;
      } else if (kind === 'glucose') {
        osc.frequency.value = 420;
        accent.frequency.value = 680;
      } else {
        osc.frequency.value = 360;
        accent.frequency.value = 540;
      }

      const comboBoost = clamp((comboMultiplier || 1) - 1, 0, 0.8);
      osc.frequency.value += comboBoost * 90;
      accent.frequency.value += comboBoost * 110;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.048, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      accentGain.gain.setValueAtTime(0.001, now);
      accentGain.gain.exponentialRampToValueAtTime(0.02, now + 0.007);
      accentGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      accent.connect(accentGain);
      gain.connect(this.masterGain);
      accentGain.connect(this.masterGain);
      osc.start(now);
      accent.start(now);
      osc.stop(now + 0.1);
      accent.stop(now + 0.08);
    }

    playNearMiss() {
      if (!this.canPlay()) {
        return;
      }

      const now = this.context.currentTime;
      if (now - this.lastNearMissTime < 0.12) {
        return;
      }
      this.lastNearMissTime = now;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.06);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    playCombo(comboCount) {
      if (!this.canPlay() || comboCount < 3) {
        return;
      }

      const now = this.context.currentTime;
      if (now - this.lastComboTime < 0.2) {
        return;
      }
      this.lastComboTime = now;

      const root = 470 + Math.min(180, (comboCount - 3) * 25);
      const oscA = this.context.createOscillator();
      const oscB = this.context.createOscillator();
      const gain = this.context.createGain();

      oscA.type = 'triangle';
      oscB.type = 'sine';
      oscA.frequency.setValueAtTime(root, now);
      oscA.frequency.exponentialRampToValueAtTime(root * 1.2, now + 0.06);
      oscB.frequency.setValueAtTime(root * 1.5, now);
      oscB.frequency.exponentialRampToValueAtTime(root * 1.75, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(this.masterGain);
      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + 0.12);
      oscB.stop(now + 0.12);
    }

    playBoostStart() {
      if (!this.canPlay()) {
        return;
      }
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.1);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.028, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
      this.lastBoostPulseTime = now;
    }

    playBoostPulse() {
      if (!this.canPlay()) {
        return;
      }
      const now = this.context.currentTime;
      if (now - this.lastBoostPulseTime < 0.17) {
        return;
      }
      this.lastBoostPulseTime = now;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.012, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playBoostStop() {
      if (!this.canPlay()) {
        return;
      }
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.11);
    }

    playRespawn() {
      if (!this.canPlay()) {
        return;
      }
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const shimmer = this.context.createOscillator();
      const gain = this.context.createGain();
      const shimmerGain = this.context.createGain();

      osc.type = 'triangle';
      shimmer.type = 'sine';

      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.15);
      shimmer.frequency.setValueAtTime(620, now);
      shimmer.frequency.exponentialRampToValueAtTime(980, now + 0.15);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      shimmerGain.gain.setValueAtTime(0.001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.014, now + 0.016);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      shimmer.connect(shimmerGain);
      gain.connect(this.masterGain);
      shimmerGain.connect(this.masterGain);

      osc.start(now);
      shimmer.start(now);
      osc.stop(now + 0.19);
      shimmer.stop(now + 0.18);
    }

    playDeath(reason) {
      if (!this.context || !this.masterGain || this.muted) {
        return;
      }

      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sawtooth';
      const startFrequency = reason === 'boundary' ? 190 : reason === 'body' ? 170 : 160;
      osc.frequency.setValueAtTime(startFrequency, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.38);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    playLethalWarning(threat) {
      if (!this.canPlay()) {
        return;
      }

      const clampedThreat = clamp(threat || 0, 0, 1);
      if (clampedThreat < 0.15) {
        return;
      }

      const now = this.context.currentTime;
      const minInterval = lerp(0.38, 0.14, clampedThreat);
      if (now - this.lastHazardWarningTime < minInterval) {
        return;
      }
      this.lastHazardWarningTime = now;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = clampedThreat > 0.7 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(250 + clampedThreat * 220, now);
      osc.frequency.exponentialRampToValueAtTime(170 + clampedThreat * 120, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.01 + clampedThreat * 0.03, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.11);
    }

    playViscosityCue(entering) {
      if (!this.canPlay()) {
        return;
      }

      const now = this.context.currentTime;
      if (now - this.lastViscosityCueTime < 0.2) {
        return;
      }
      this.lastViscosityCueTime = now;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = entering ? 'sine' : 'triangle';

      if (entering) {
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(235, now + 0.11);
      } else {
        osc.frequency.setValueAtTime(230, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.022, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }
  }

  class SpawnSystem {
    constructor(game) {
      this.game = game;
      this.collectibles = [];
      this.dropPool = [];
      this.dropPoolSize = 420;
      this.spawnTimer = 0;

      for (let i = 0; i < this.dropPoolSize; i += 1) {
        const drop = new Collectible('nutrient');
        drop.active = false;
        drop.isDrop = true;
        this.dropPool.push(drop);
      }
    }

    activeAmbientCount() {
      let count = 0;
      for (let i = 0; i < this.collectibles.length; i += 1) {
        if (this.collectibles[i].active) {
          count += 1;
        }
      }
      return count;
    }

    activeDropCount() {
      let count = 0;
      for (let i = 0; i < this.dropPool.length; i += 1) {
        if (this.dropPool[i].active) {
          count += 1;
        }
      }
      return count;
    }

    weightedKind() {
      const entries = CONFIG.collectibles.types;
      const roll = Math.random();
      if (roll < entries.glucose.weight) {
        return 'glucose';
      }
      if (roll < entries.glucose.weight + entries.amino.weight) {
        return 'amino';
      }
      return 'atp';
    }

    findDropSlot() {
      for (let i = 0; i < this.dropPool.length; i += 1) {
        if (!this.dropPool[i].active) {
          return this.dropPool[i];
        }
      }
      return null;
    }

    findCollectibleSlot() {
      for (let i = 0; i < this.collectibles.length; i += 1) {
        if (!this.collectibles[i].active) {
          return this.collectibles[i];
        }
      }
      return null;
    }

    spawnAmbient(kind, x, y, ttl) {
      let collectible = this.findCollectibleSlot();

      if (!collectible) {
        if (this.collectibles.length >= CONFIG.collectibles.maxAmbient) {
          return null;
        }
        collectible = new Collectible(kind);
        this.collectibles.push(collectible);
      }

      collectible.reset(kind, x, y, typeof ttl === 'number' ? ttl : 24, false, this.game.time);
      return collectible;
    }

    spawnDrop(kind, x, y, ttl) {
      const drop = this.findDropSlot();
      if (!drop) {
        return null;
      }

      drop.reset(kind, x, y, typeof ttl === 'number' ? ttl : 10, true, this.game.time);
      return drop;
    }

    chooseSpawnPoint(organisms, avoidLargest) {
      const world = CONFIG.world;
      const margin = 60;
      let bestPoint = null;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 9; attempt += 1) {
        const point = {
          x: rand(margin, world.width - margin),
          y: rand(margin, world.height - margin)
        };

        let blocked = false;
        for (let i = 0; i < this.game.hazards.length; i += 1) {
          const hazard = this.game.hazards[i];
          const minGap = hazard.radius + 18;
          if (sqrDistance(point.x, point.y, hazard.x, hazard.y) < minGap * minGap) {
            blocked = true;
            break;
          }
        }

        if (blocked) {
          continue;
        }

        let nearestOrganism = Infinity;
        for (let i = 0; i < organisms.length; i += 1) {
          const org = organisms[i];
          if (!org.alive) {
            continue;
          }
          const d = Math.sqrt(sqrDistance(point.x, point.y, org.head.x, org.head.y));
          nearestOrganism = Math.min(nearestOrganism, d);
        }

        const fromLargest = avoidLargest
          ? Math.sqrt(sqrDistance(point.x, point.y, avoidLargest.head.x, avoidLargest.head.y))
          : 0;

        const score =
          nearestOrganism * 0.45 +
          fromLargest * CONFIG.collectibles.antiSnowballWeight +
          Math.random() * 60;

        if (score > bestScore) {
          bestScore = score;
          bestPoint = point;
        }
      }

      return (
        bestPoint || {
          x: rand(margin, world.width - margin),
          y: rand(margin, world.height - margin)
        }
      );
    }

    getLargestOrganism(organisms) {
      let largest = null;
      for (let i = 0; i < organisms.length; i += 1) {
        const org = organisms[i];
        if (!org.alive) {
          continue;
        }
        if (!largest || org.mass > largest.mass) {
          largest = org;
        }
      }
      return largest;
    }

    seedInitial(organisms) {
      this.collectibles.length = 0;
      for (let i = 0; i < this.dropPool.length; i += 1) {
        this.dropPool[i].active = false;
      }

      const largest = this.getLargestOrganism(organisms);
      for (let i = 0; i < CONFIG.collectibles.minAmbient; i += 1) {
        const point = this.chooseSpawnPoint(organisms, largest);
        this.spawnAmbient(this.weightedKind(), point.x, point.y, rand(18, 30));
      }
    }

    spawnNearMissDrops(originX, originY) {
      for (let i = 0; i < CONFIG.collectibles.nearMissDropCount; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const radius = rand(10, 24);
        const x = originX + Math.cos(angle) * radius;
        const y = originY + Math.sin(angle) * radius;
        this.spawnDrop('nutrient', x, y, 6);
      }
    }

    spawnLysisDrops(organism) {
      const step = 2;
      for (let i = 1; i < organism.segments.length; i += step) {
        const segment = organism.segments[i];
        const chance = Math.random();
        let kind = 'nutrient';
        if (chance > 0.78) {
          kind = 'amino';
        } else if (chance > 0.4) {
          kind = 'glucose';
        }
        this.spawnDrop(
          kind,
          segment.x + rand(-4, 4),
          segment.y + rand(-4, 4),
          rand(8, 16)
        );
      }
    }

    update(dt, organisms) {
      this.spawnTimer += dt;
      const largest = this.getLargestOrganism(organisms);

      if (this.spawnTimer >= CONFIG.collectibles.spawnInterval) {
        this.spawnTimer = 0;
        for (let i = 0; i < CONFIG.collectibles.spawnBurst; i += 1) {
          if (this.activeAmbientCount() >= CONFIG.collectibles.maxAmbient) {
            break;
          }
          const point = this.chooseSpawnPoint(organisms, largest);
          this.spawnAmbient(this.weightedKind(), point.x, point.y, rand(18, 32));
        }
      }

      if (this.activeAmbientCount() < CONFIG.collectibles.minAmbient) {
        const needed = CONFIG.collectibles.minAmbient - this.activeAmbientCount();
        for (let i = 0; i < needed; i += 1) {
          const point = this.chooseSpawnPoint(organisms, largest);
          this.spawnAmbient(this.weightedKind(), point.x, point.y, rand(20, 36));
        }
      }

      for (let i = 0; i < this.collectibles.length; i += 1) {
        const collectible = this.collectibles[i];
        if (!collectible.active) {
          continue;
        }
        collectible.ttl -= dt;
        if (collectible.ttl <= 0) {
          collectible.active = false;
        }
      }

      for (let i = 0; i < this.dropPool.length; i += 1) {
        const drop = this.dropPool[i];
        if (!drop.active) {
          continue;
        }
        drop.ttl -= dt;
        drop.fresh = drop.fresh && this.game.time - drop.spawnTime < 4;
        if (drop.ttl <= 0) {
          drop.active = false;
        }
      }
    }
  }

  class AISystem {
    constructor(game) {
      this.game = game;
      this.tempNearby = [];
      this.tempCollectibles = [];
    }

    evaluateHeadingRisk(bot, angle, nearbySegments) {
      const probeDistance = clamp(62 + bot.mass * 0.95, 62, 170);
      const probeX = wrapCoordinate(bot.head.x + Math.cos(angle) * probeDistance, WORLD_WIDTH);
      const probeY = wrapCoordinate(bot.head.y + Math.sin(angle) * probeDistance, WORLD_HEIGHT);
      let risk = 0;
      const stride = nearbySegments.length > 52 ? 2 : 1;

      for (let i = 0; i < nearbySegments.length; i += stride) {
        const segment = nearbySegments[i];
        const owner = segment._owner;
        if (owner.id === bot.id && segment._index < CONFIG.collisions.bodyIgnoreSegments + 10) {
          continue;
        }

        const clearance =
          Math.sqrt(sqrDistance(probeX, probeY, segment.x, segment.y)) - segment._radius;
        if (clearance < 0) {
          return 999;
        }

        if (clearance < 84) {
          const ownerWeight = owner.id === bot.id ? 0.48 : 1.18;
          risk += ((84 - clearance) / 84) * ownerWeight;
        }
      }

      for (let i = 0; i < this.game.hazards.length; i += 1) {
        const hazard = this.game.hazards[i];
        const clearance = Math.sqrt(sqrDistance(probeX, probeY, hazard.x, hazard.y)) - hazard.radius;
        if (hazard.isLethal()) {
          if (clearance < 0) {
            return 999;
          }
          if (clearance < 88) {
            risk += ((88 - clearance) / 88) * 1.85;
          }
        } else if (clearance < 66) {
          risk += ((66 - clearance) / 66) * 0.62;
        }
      }

      return risk;
    }

    chooseHeading(bot, baseAngle, nearbySegments, danger) {
      if (bot.aiTier !== 'elite' && danger < 0.42) {
        return baseAngle;
      }

      const spread = bot.aiTier === 'elite' ? 0.56 : 0.4;
      const candidates =
        bot.aiTier === 'elite'
          ? [
              baseAngle,
              baseAngle + spread,
              baseAngle - spread,
              baseAngle + spread * 1.7
            ]
          : [baseAngle, baseAngle + spread, baseAngle - spread];

      let bestAngle = baseAngle;
      let bestScore = Infinity;
      const dangerBias = clamp(danger, 0, 2.8);

      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const risk = this.evaluateHeadingRisk(bot, candidate, nearbySegments);
        const alignmentPenalty = Math.abs(normalizeAngle(candidate - baseAngle)) * 0.44;
        const score = risk * (1.25 - clamp(bot.riskTolerance * 0.35, 0.12, 0.5) + dangerBias * 0.08) + alignmentPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestAngle = candidate;
        }
      }

      return bestAngle;
    }

    pickPrey(bot, danger, aggressive) {
      if (bot.aiTier !== 'elite' && !aggressive) {
        return null;
      }
      if (!aggressive && danger > 1.05) {
        return null;
      }

      let target = null;
      let bestScore = -Infinity;

      const considerCandidate = (candidate) => {
        if (!candidate.alive || candidate.id === bot.id) {
          return;
        }
        const maxTargetMassRatio = aggressive ? 1.03 : 0.92;
        if (candidate.mass >= bot.mass * maxTargetMassRatio) {
          return;
        }

        const dx = wrappedDeltaX(candidate.head.x, bot.head.x);
        const dy = wrappedDeltaY(candidate.head.y, bot.head.y);
        const distance = Math.hypot(dx, dy);
        const maxDistance = aggressive ? 360 : 280;
        if (distance > maxDistance) {
          return;
        }

        const massAdvantage = clamp((bot.mass - candidate.mass) / Math.max(1, candidate.mass), 0, 2.2);
        const score =
          massAdvantage * (aggressive ? 38 : 34) -
          distance * (aggressive ? 0.092 : 0.11);
        if (score > bestScore) {
          bestScore = score;
          target = candidate;
        }
      };

      considerCandidate(this.game.player);
      for (let i = 0; i < this.game.bots.length; i += 1) {
        considerCandidate(this.game.bots[i]);
      }

      return target;
    }

    updateBot(bot, dt) {
      if (!bot.alive) {
        return;
      }

      bot.thinkCooldown -= dt;
      bot.boostCooldown -= dt;
      bot.aggressionCooldown -= dt;
      bot.aggressionTimer = Math.max(0, bot.aggressionTimer - dt);

      if (bot.thinkCooldown > 0) {
        return;
      }
      bot.thinkCooldown = clamp(rand(0.055, 0.14) / bot.intellect, 0.04, 0.16);

      let forceX = Math.cos(bot.angle) * 0.2;
      let forceY = Math.sin(bot.angle) * 0.2;
      let danger = 0;
      let bestCollectible = null;
      let bestValue = -Infinity;

      const segmentHash = this.game.segmentHash;
      const collectibleHash = this.game.collectibleHash;

      const avoidRadius =
        CONFIG.bots.avoidRadius * (bot.aiTier === 'elite' ? 1.28 : 1.08);
      segmentHash.queryCircle(bot.head.x, bot.head.y, avoidRadius, this.tempNearby);
      for (let i = 0; i < this.tempNearby.length; i += 1) {
        const segment = this.tempNearby[i];
        const owner = segment._owner;

        if (owner.id === bot.id && segment._index < CONFIG.collisions.bodyIgnoreSegments) {
          continue;
        }

        const dx = wrappedDeltaX(bot.head.x, segment.x);
        const dy = wrappedDeltaY(bot.head.y, segment.y);
        const distance = Math.hypot(dx, dy) || 0.0001;
        const safeRadius = avoidRadius + segment._radius;
        if (distance < safeRadius) {
          const intensity = (safeRadius - distance) / safeRadius;
          const weight = owner.id === bot.id ? 1.35 : 2.8;
          forceX += (dx / distance) * intensity * weight;
          forceY += (dy / distance) * intensity * weight;
          danger += intensity;
        }
      }

      for (let i = 0; i < this.game.hazards.length; i += 1) {
        const hazard = this.game.hazards[i];
        const dx = wrappedDeltaX(bot.head.x, hazard.x);
        const dy = wrappedDeltaY(bot.head.y, hazard.y);
        const distance = Math.hypot(dx, dy) || 0.0001;
        const range = hazard.radius + CONFIG.bots.dangerRadius * (bot.aiTier === 'elite' ? 1.12 : 1);
        if (distance < range) {
          const strength = (range - distance) / range;
          const push = hazard.isLethal() ? 3.2 : 2.1;
          forceX += (dx / distance) * strength * push;
          forceY += (dy / distance) * strength * push;
          if (hazard.isLethal()) {
            danger += strength;
          }
        }
      }

      collectibleHash.queryCircle(bot.head.x, bot.head.y, CONFIG.bots.scanRadius, this.tempCollectibles);
      for (let i = 0; i < this.tempCollectibles.length; i += 1) {
        const collectible = this.tempCollectibles[i];
        if (!collectible.active) {
          continue;
        }
        const dist = Math.sqrt(sqrDistance(bot.head.x, bot.head.y, collectible.x, collectible.y));
        const value =
          collectible.scoreValue * (collectible.fresh ? 1.24 * bot.opportunism : 1) +
          (collectible.isDrop ? 2.8 * bot.opportunism : 0) -
          dist * (0.044 + clamp(danger, 0, 1.8) * 0.016);
        if (value > bestValue) {
          bestValue = value;
          bestCollectible = collectible;
        }
      }

      if (bestCollectible) {
        const dx = wrappedDeltaX(bestCollectible.x, bot.head.x);
        const dy = wrappedDeltaY(bestCollectible.y, bot.head.y);
        const dist = Math.hypot(dx, dy) || 0.0001;
        const attraction = clamp(1.24 - dist / CONFIG.bots.scanRadius, 0.16, 1.24) * bot.personality;
        forceX += (dx / dist) * attraction * 2.05;
        forceY += (dy / dist) * attraction * 2.05;
      }

      if (bot.aggressionCooldown <= 0 && bot.aggressionTimer <= 0 && danger < 1.05) {
        const triggerChance = bot.aiTier === 'elite' ? 0.015 : 0.008;
        if (Math.random() < triggerChance) {
          bot.aggressionTimer = rand(2.8, 5.6);
          bot.aggressionCooldown = rand(6.5, 12.5);
        }
      }

      const aggressive = bot.aggressionTimer > 0;
      const prey = this.pickPrey(bot, danger, aggressive);
      if (prey) {
        const preyDx = wrappedDeltaX(prey.head.x, bot.head.x);
        const preyDy = wrappedDeltaY(prey.head.y, bot.head.y);
        const preyDist = Math.hypot(preyDx, preyDy) || 0.0001;
        const chaseStrength = clamp((bot.mass - prey.mass) / Math.max(14, prey.mass), 0.15, 1.2);
        const aggressionBoost = aggressive ? 1.35 : 1;
        forceX += (preyDx / preyDist) * chaseStrength * 0.95 * aggressionBoost;
        forceY += (preyDy / preyDist) * chaseStrength * 0.95 * aggressionBoost;
      }

      const baseAngle = Math.atan2(forceY, forceX);
      const desiredAngle = this.chooseHeading(bot, baseAngle, this.tempNearby, danger);
      bot.targetX = wrapCoordinate(bot.head.x + Math.cos(desiredAngle) * 120, WORLD_WIDTH);
      bot.targetY = wrapCoordinate(bot.head.y + Math.sin(desiredAngle) * 120, WORLD_HEIGHT);
      bot.targetWeight = bestValue;

      const chaseBoost =
        Boolean(bestCollectible) &&
        (bestCollectible.scoreValue >= 18 || bestCollectible.fresh) &&
        danger < bot.riskTolerance + (aggressive ? 0.28 : 0) &&
        bot.boostCooldown <= 0 &&
        bot.mass > CONFIG.player.minBoostMass + 6;
      const aggroBoost =
        aggressive &&
        Boolean(prey) &&
        danger < bot.riskTolerance + 0.42 &&
        bot.boostCooldown <= 0 &&
        bot.mass > CONFIG.player.minBoostMass + 5;
      const escapeBoost =
        danger > 1.1 * bot.riskTolerance &&
        bot.boostCooldown <= 0 &&
        bot.mass > CONFIG.player.minBoostMass + 4;
      bot.wantsBoost = chaseBoost || aggroBoost || escapeBoost;

      if (bot.wantsBoost) {
        bot.boostCooldown = rand(CONFIG.bots.boostCooldown * 0.6, CONFIG.bots.boostCooldown * 1.3);
      }
    }
  }

  class CollisionSystem {
    constructor(game) {
      this.game = game;
      this.segmentQuery = [];
      this.collectibleQuery = [];
      this.nearMissCooldowns = new Map();
    }

    buildHashes(organisms) {
      this.game.segmentHash.clear();
      this.game.collectibleHash.clear();

      for (let i = 0; i < organisms.length; i += 1) {
        const organism = organisms[i];
        if (!organism.alive) {
          continue;
        }

        for (let j = 0; j < organism.segments.length; j += 1) {
          const segment = organism.segments[j];
          segment._owner = organism;
          segment._index = j;
          segment._radius = organism.segmentRadius(j);
          this.game.segmentHash.insert(segment, segment.x, segment.y, segment._radius);
        }
      }

      for (let i = 0; i < this.game.spawner.collectibles.length; i += 1) {
        const collectible = this.game.spawner.collectibles[i];
        if (!collectible.active) {
          continue;
        }
        this.game.collectibleHash.insert(collectible, collectible.x, collectible.y, collectible.radius);
      }

      for (let i = 0; i < this.game.spawner.dropPool.length; i += 1) {
        const drop = this.game.spawner.dropPool[i];
        if (!drop.active) {
          continue;
        }
        this.game.collectibleHash.insert(drop, drop.x, drop.y, drop.radius);
      }
    }

    checkHazardCollision(organism) {
      for (let i = 0; i < this.game.hazards.length; i += 1) {
        const hazard = this.game.hazards[i];
        const reach = hazard.radius + organism.config.headRadius;

        if (sqrDistance(organism.head.x, organism.head.y, hazard.x, hazard.y) <= reach * reach) {
          if (hazard.isLethal()) {
            return hazard;
          }
        }
      }

      return null;
    }

    checkBoundaryCollision(organism) {
      // Endless mode: world edges wrap, so boundaries are non-lethal.
      return false;
    }

    handleNearMiss(player, segment, distance, collisionDistance) {
      if (segment._owner.id === player.id) {
        return;
      }

      if (distance <= collisionDistance + 2) {
        return;
      }

      const nearDistance = collisionDistance + CONFIG.collisions.nearMissBand;
      if (distance > nearDistance) {
        return;
      }

      const key = segment._owner.id + ':' + Math.floor(segment._index / 4);
      const expires = this.nearMissCooldowns.get(key) || 0;
      if (expires > this.game.time) {
        return;
      }

      this.nearMissCooldowns.set(key, this.game.time + CONFIG.collectibles.nearMissCooldown);
      this.game.spawner.spawnNearMissDrops(player.head.x, player.head.y);
      player.score += 6;
      this.game.audio.playNearMiss();
    }

    applyCollisions(organisms) {
      for (let i = 0; i < organisms.length; i += 1) {
        const organism = organisms[i];

        if (!organism.alive) {
          continue;
        }

        if (organism.invulnerableTimer <= 0) {
          if (this.checkBoundaryCollision(organism)) {
            this.game.killOrganism(organism, 'boundary');
            continue;
          }

          const hazard = this.checkHazardCollision(organism);
          if (hazard) {
            this.game.killOrganism(organism, hazard.kind);
            continue;
          }
        }

        const headX = organism.head.x;
        const headY = organism.head.y;
        const headRadius = organism.config.headRadius;

        this.game.segmentHash.queryCircle(
          headX,
          headY,
          headRadius + CONFIG.bots.avoidRadius,
          this.segmentQuery
        );

        let diedToBody = false;

        for (let j = 0; j < this.segmentQuery.length; j += 1) {
          const segment = this.segmentQuery[j];
          const owner = segment._owner;

          // Ignore stale hash entries.
          if (!owner.alive) {
            continue;
          }

          // Self-collision is disabled for all organisms.
          if (owner.id === organism.id) {
            continue;
          }

          const distance = Math.sqrt(sqrDistance(headX, headY, segment.x, segment.y));
          const collisionDistance = headRadius + segment._radius * 0.96;

          if (organism.isPlayer) {
            this.handleNearMiss(organism, segment, distance, collisionDistance);
          }

          if (organism.invulnerableTimer > 0) {
            continue;
          }

          if (distance <= collisionDistance) {
            this.game.killOrganism(organism, 'body');
            diedToBody = true;
            break;
          }
        }

        if (diedToBody || !organism.alive) {
          continue;
        }

        this.game.collectibleHash.queryCircle(
          headX,
          headY,
          headRadius + CONFIG.collisions.collectibleRange,
          this.collectibleQuery
        );

        for (let j = 0; j < this.collectibleQuery.length; j += 1) {
          const collectible = this.collectibleQuery[j];
          if (!collectible.active) {
            continue;
          }

          const reach = headRadius + collectible.radius;
          if (sqrDistance(headX, headY, collectible.x, collectible.y) > reach * reach) {
            continue;
          }

          collectible.active = false;
          const prevCombo = organism.comboCount;
          organism.applyGrowth(collectible.massValue);
          organism.recordPickup(collectible.scoreValue, this.game.time);

          if (organism.isPlayer) {
            this.game.audio.playCollect(collectible.kind, organism.comboMultiplier);
            if (organism.comboCount > prevCombo && organism.comboCount >= 3) {
              this.game.audio.playCombo(organism.comboCount);
            }
          }

          this.game.spawnPickupParticles(collectible, organism);
        }
      }

      this.cleanupNearMissCache();
    }

    cleanupNearMissCache() {
      if (this.nearMissCooldowns.size < 120) {
        return;
      }
      for (const [key, expiry] of this.nearMissCooldowns.entries()) {
        if (expiry <= this.game.time) {
          this.nearMissCooldowns.delete(key);
        }
      }
    }
  }

  class UISystem {
    constructor(game) {
      this.game = game;
      this.el = {
        hudSize: document.getElementById('hud-size'),
        hudScore: document.getElementById('hud-score'),
        muteButton: document.getElementById('mute-toggle'),
        settingsToggle: document.getElementById('settings-toggle'),
        touchBoost: document.getElementById('touch-boost'),
        startScreen: document.getElementById('start-screen'),
        controlsPanel: document.getElementById('controls-panel'),
        settingsPanel: document.getElementById('settings-panel'),
        playButton: document.getElementById('play-button'),
        controlsButton: document.getElementById('controls-button'),
        settingsButton: document.getElementById('settings-button'),
        playAgain: document.getElementById('play-again'),
        gameOver: document.getElementById('game-over'),
        finalSize: document.getElementById('final-size'),
        finalScore: document.getElementById('final-score'),
        controlSelect: document.getElementById('control-select'),
        qualitySelect: document.getElementById('quality-select'),
        muteInput: document.getElementById('mute-input')
      };

      this.bindEvents();
      this.syncSettingsUI();
      this.setPanelVisibility('controls', false);
      this.setPanelVisibility('settings', false);
      this.setGameOver(false);
      this.showStart(true);
      this.updateTouchBoostVisibility();
    }

    bindIf(el, eventName, handler, options) {
      if (!el) {
        return;
      }
      el.addEventListener(eventName, handler, options);
    }

    bindEvents() {
      this.bindIf(this.el.playButton, 'click', () => {
        this.game.audio.unlock();
        this.game.audio.playUi('start');
        this.showStart(false);
        this.setPanelVisibility('controls', false);
        this.setPanelVisibility('settings', false);
        this.setGameOver(false);
        this.game.startRun();
        this.updateTouchBoostVisibility();
      });

      this.bindIf(this.el.playAgain, 'click', () => {
        this.game.audio.unlock();
        this.game.audio.playUi('start');
        this.game.forcePlayerRespawn();
        this.updateTouchBoostVisibility();
      });

      this.bindIf(this.el.controlsButton, 'click', () => {
        this.game.audio.playUi('tap');
        this.setPanelVisibility('controls', true);
      });

      this.bindIf(this.el.settingsButton, 'click', () => {
        this.game.audio.playUi('tap');
        this.setPanelVisibility('settings', true);
      });

      this.bindIf(this.el.settingsToggle, 'click', () => {
        this.game.audio.playUi(this.isPanelVisible('settings') ? 'close' : 'tap');
        this.setPanelVisibility('settings', !this.isPanelVisible('settings'));
      });

      document.querySelectorAll('[data-close-panel="controls"]').forEach((button) => {
        button.addEventListener('click', () => {
          this.game.audio.playUi('close');
          this.setPanelVisibility('controls', false);
        });
      });

      document.querySelectorAll('[data-close-panel="settings"]').forEach((button) => {
        button.addEventListener('click', () => {
          this.game.audio.playUi('close');
          this.setPanelVisibility('settings', false);
        });
      });

      this.bindIf(this.el.controlSelect, 'change', () => {
        this.game.audio.playUi('tap');
        this.game.settings.controlScheme = this.el.controlSelect.value;
        this.game.input.setControlScheme(this.game.settings.controlScheme);
        this.persistSettings();
      });

      this.bindIf(this.el.qualitySelect, 'change', () => {
        this.game.audio.playUi('tap');
        this.game.settings.quality = this.el.qualitySelect.value;
        this.persistSettings();
      });

      this.bindIf(this.el.muteInput, 'change', () => {
        this.game.settings.muted = this.el.muteInput.checked;
        this.game.audio.setMuted(this.game.settings.muted);
        if (!this.game.settings.muted) {
          this.game.audio.playUi('tap');
        }
        this.syncMuteButtons();
        this.persistSettings();
      });

      this.bindIf(this.el.muteButton, 'click', () => {
        this.game.settings.muted = !this.game.settings.muted;
        this.game.audio.setMuted(this.game.settings.muted);
        if (!this.game.settings.muted) {
          this.game.audio.playUi('tap');
        }
        this.syncMuteButtons();
        this.persistSettings();
      });

      const setTouchBoostState = (active) => {
        this.game.input.setTouchBoost(active);
        if (this.el.touchBoost) {
          this.el.touchBoost.classList.toggle('touch-boost--active', active);
        }
      };
      this.bindIf(this.el.touchBoost, 'pointerdown', (event) => {
        event.preventDefault();
        setTouchBoostState(true);
      });
      this.bindIf(this.el.touchBoost, 'pointerup', () => setTouchBoostState(false));
      this.bindIf(this.el.touchBoost, 'pointercancel', () => setTouchBoostState(false));
      this.bindIf(this.el.touchBoost, 'pointerleave', () => setTouchBoostState(false));
      this.bindIf(this.el.touchBoost, 'touchstart', (event) => {
        event.preventDefault();
        setTouchBoostState(true);
      }, { passive: false });
      this.bindIf(this.el.touchBoost, 'touchend', () => setTouchBoostState(false), { passive: true });
      this.bindIf(this.el.touchBoost, 'touchcancel', () => setTouchBoostState(false), { passive: true });
      this.bindIf(this.el.touchBoost, 'mousedown', (event) => {
        event.preventDefault();
        setTouchBoostState(true);
      });
      window.addEventListener('mouseup', () => setTouchBoostState(false));

    }

    persistSettings() {
      try {
        window.localStorage.setItem('microcosm-settings', JSON.stringify(this.game.settings));
      } catch (error) {
        // Non-critical persistence failure.
      }
    }

    syncSettingsUI() {
      if (this.el.controlSelect) {
        this.el.controlSelect.value = this.game.settings.controlScheme;
      }
      if (this.el.qualitySelect) {
        this.el.qualitySelect.value = this.game.settings.quality;
      }
      if (this.el.muteInput) {
        this.el.muteInput.checked = this.game.settings.muted;
      }
      this.syncMuteButtons();
    }

    syncMuteButtons() {
      const muted = this.game.settings.muted;
      if (this.el.muteButton) {
        this.el.muteButton.textContent = muted ? 'Mute: On' : 'Mute: Off';
        this.el.muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
      }
      if (this.el.muteInput) {
        this.el.muteInput.checked = muted;
      }
    }

    isPanelVisible(panelName) {
      const panel = panelName === 'controls' ? this.el.controlsPanel : this.el.settingsPanel;
      if (!panel) {
        return false;
      }
      return !panel.hidden;
    }

    isTouchDevice() {
      return (
        window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      );
    }

    updateTouchBoostVisibility() {
      if (!this.el.touchBoost) {
        return;
      }
      const overlaysOpen =
        (this.el.startScreen && !this.el.startScreen.hidden) ||
        (this.el.gameOver && !this.el.gameOver.hidden) ||
        this.isPanelVisible('controls') ||
        this.isPanelVisible('settings');
      const show = this.game.running && !overlaysOpen && this.isTouchDevice();

      this.el.touchBoost.hidden = !show;
      if (!show) {
        this.el.touchBoost.classList.remove('touch-boost--active');
        this.game.input.setTouchBoost(false);
      }
    }

    setPanelVisibility(panelName, visible) {
      const panel = panelName === 'controls' ? this.el.controlsPanel : this.el.settingsPanel;
      if (!panel) {
        return;
      }
      panel.hidden = !visible;
      panel.classList.toggle('overlay--visible', visible);
      this.updateTouchBoostVisibility();
    }

    showStart(show) {
      if (!this.el.startScreen) {
        return;
      }
      this.el.startScreen.hidden = !show;
      this.el.startScreen.classList.toggle('overlay--visible', show);
      this.updateTouchBoostVisibility();
    }

    setGameOver(show, stats) {
      if (!this.el.gameOver) {
        return;
      }
      this.el.gameOver.hidden = !show;
      this.el.gameOver.classList.toggle('overlay--visible', show);
      if (show && stats && this.el.finalSize && this.el.finalScore) {
        this.el.finalSize.textContent = String(stats.size);
        this.el.finalScore.textContent = String(stats.score);
      }
      this.updateTouchBoostVisibility();
    }

    updateHUD() {
      const player = this.game.player;

      if (this.el.hudSize) {
        this.el.hudSize.textContent = String(Math.round(player.mass));
      }
      if (this.el.hudScore) {
        this.el.hudScore.textContent = String(player.score);
      }
    }

  }

  class Game {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });

      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.viewport = { width: 1, height: 1 };

      this.time = 0;
      this.accumulator = 0;
      this.lastFrame = 0;
      this.fps = 60;
      this.running = false;
      this.paused = false;

      this.settings = this.loadSettings();

      this.camera = {
        x: CONFIG.world.width * 0.5,
        y: CONFIG.world.height * 0.5,
        zoom: CONFIG.camera.zoom
      };

      this.backgroundClouds = this.createBackgroundClouds();
      this.backgroundStars = this.createBackgroundPoints();
      this.groundDetails = this.createGroundDetails();
      this.canopyRays = this.createCanopyRays();
      this.ambientMotes = this.createAmbientMotes();

      this.input = new InputSystem(this.canvas);
      this.input.setControlScheme(this.settings.controlScheme);

      this.audio = new AudioSystem();
      this.audio.setMuted(this.settings.muted);

      this.segmentHash = new SpatialHash(68);
      this.collectibleHash = new SpatialHash(78);

      this.player = new Organism(CONFIG.player, true);
      this.bots = [];
      this.hazards = [];
      this.spawner = new SpawnSystem(this);
      this.ai = new AISystem(this);
      this.collisions = new CollisionSystem(this);
      this.particles = new ParticlePool(CONFIG.rendering.maxParticles);

      this.bestSize = this.player.mass;
      this.playerInViscosity = false;
      this.ui = new UISystem(this);

      this.resize();
      this.resetWorld();

      window.addEventListener('resize', () => this.resize());
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.resize());
        window.visualViewport.addEventListener('scroll', () => this.resize());
      }
      requestAnimationFrame((time) => this.frame(time));
    }

    loadSettings() {
      const defaults = {
        controlScheme: 'mouse',
        quality: 'auto',
        muted: false
      };

      try {
        const raw = window.localStorage.getItem('microcosm-settings');
        if (!raw) {
          return defaults;
        }
        const parsed = JSON.parse(raw);
        return {
          controlScheme: parsed.controlScheme === 'keyboard' ? 'keyboard' : 'mouse',
          quality: ['auto', 'high', 'low'].includes(parsed.quality) ? parsed.quality : 'auto',
          muted: Boolean(parsed.muted)
        };
      } catch (error) {
        return defaults;
      }
    }

    createBackgroundPoints() {
      const points = [];
      for (let i = 0; i < CONFIG.rendering.backgroundDots; i += 1) {
        const roll = Math.random();
        const hue = randInt(168, 214);
        points.push({
          x: rand(0, CONFIG.world.width),
          y: rand(0, CONFIG.world.height),
          size: rand(0.8, 3.1),
          alpha: rand(0.07, 0.33),
          rotation: rand(0, Math.PI * 2),
          stretch: rand(0.55, 1.65),
          hue: hue,
          pulse: rand(0.2, 1.4),
          colorSoft: 'hsla(' + hue + ', 72%, 76%, 0.22)',
          colorMid: 'hsla(' + hue + ', 64%, 68%, 0.32)',
          colorBright: 'hsla(' + (hue + 12) + ', 84%, 82%, 0.34)',
          stroke: 'hsla(' + (hue + 8) + ', 82%, 82%, 0.34)',
          kind:
            roll < 0.16
              ? 'bubble'
              : roll < 0.36
                ? 'organelle'
                : roll < 0.58
                  ? 'colony'
                  : roll < 0.78
                    ? 'spike'
                    : 'speck'
        });
      }
      return points;
    }

    createBackgroundClouds() {
      const clouds = [];
      for (let i = 0; i < CONFIG.rendering.backgroundClouds; i += 1) {
        const hue = randInt(178, 206);
        clouds.push({
          x: rand(0, CONFIG.world.width),
          y: rand(0, CONFIG.world.height),
          radius: rand(120, 320),
          stretch: rand(0.62, 1.6),
          alpha: rand(0.05, 0.16),
          hue: hue,
          colorMain: 'hsla(' + hue + ', 66%, 68%, 0.95)',
          colorHighlight: 'hsla(' + (hue + 12) + ', 58%, 74%, 0.78)',
          parallax: rand(0.07, 0.22),
          drift: rand(-0.2, 0.2)
        });
      }
      return clouds;
    }

    createGroundDetails() {
      const details = [];
      for (let i = 0; i < CONFIG.rendering.groundDetails; i += 1) {
        const roll = Math.random();
        const hue = randInt(168, 214);
        details.push({
          x: rand(0, CONFIG.world.width),
          y: rand(0, CONFIG.world.height),
          size: rand(8, 34),
          rotation: rand(0, Math.PI * 2),
          wobble: rand(0.2, 1.4),
          hue: hue,
          strokeFiber: 'hsla(' + hue + ', 64%, 70%, 0.42)',
          strokeMembrane: 'hsla(' + (hue + 6) + ', 68%, 74%, 0.34)',
          fillCrystal: 'hsla(' + (hue + 18) + ', 54%, 66%, 0.38)',
          strokeCrystal: 'hsla(' + (hue + 32) + ', 74%, 82%, 0.34)',
          fillPlankton: 'hsla(' + (hue - 4) + ', 66%, 66%, 0.26)',
          strokeDiatom: 'hsla(' + (hue + 12) + ', 78%, 78%, 0.38)',
          fillColony: 'hsla(' + (hue + 24) + ', 58%, 68%, 0.3)',
          type:
            roll < 0.23
              ? 'fiber'
              : roll < 0.42
                ? 'membrane'
                : roll < 0.6
                  ? 'crystal'
                  : roll < 0.78
                    ? 'plankton'
                    : roll < 0.9
                      ? 'diatom'
                      : 'colony',
          alpha: rand(0.12, 0.45)
        });
      }
      return details;
    }

    createCanopyRays() {
      const rays = [];
      for (let i = 0; i < CONFIG.rendering.canopyRays; i += 1) {
        rays.push({
          x: rand(0.06, 0.95),
          width: rand(0.05, 0.13),
          sway: rand(-1, 1),
          speed: rand(0.08, 0.22),
          alpha: rand(0.04, 0.11)
        });
      }
      return rays;
    }

    createAmbientMotes() {
      const motes = [];
      for (let i = 0; i < CONFIG.rendering.ambientMotes; i += 1) {
        motes.push({
          x: rand(0, this.viewport.width),
          y: rand(0, this.viewport.height),
          vx: rand(-6, 6),
          vy: rand(-14, -4),
          size: rand(0.8, 2.2),
          alpha: rand(0.08, 0.35),
          twinkle: rand(0, Math.PI * 2),
          warm: Math.random() < 0.24
        });
      }
      return motes;
    }

    updateAmbientMotes(dt) {
      if (!this.ambientMotes || !this.ambientMotes.length) {
        return;
      }

      const width = this.viewport.width;
      const height = this.viewport.height;
      const drift = this.getEffectiveQuality() === 'high' ? 1 : 0.6;

      for (let i = 0; i < this.ambientMotes.length; i += 1) {
        const mote = this.ambientMotes[i];
        mote.twinkle += dt * (0.7 + i * 0.003);
        mote.x += mote.vx * dt * drift;
        mote.y += mote.vy * dt * drift;

        if (mote.x < -20) {
          mote.x = width + 20;
        } else if (mote.x > width + 20) {
          mote.x = -20;
        }

        if (mote.y < -30) {
          mote.y = height + 24;
          mote.x = rand(-10, width + 10);
        }
      }
    }

    resize() {
      if (window.visualViewport) {
        this.viewport.width = Math.max(1, Math.round(window.visualViewport.width));
        this.viewport.height = Math.max(1, Math.round(window.visualViewport.height));
      } else {
        this.viewport.width = Math.max(1, window.innerWidth);
        this.viewport.height = Math.max(1, window.innerHeight);
      }
      this.canvas.width = Math.floor(this.viewport.width * this.dpr);
      this.canvas.height = Math.floor(this.viewport.height * this.dpr);
    }

    resetWorld() {
      this.hazards = this.generateHazards();
      this.spawnPlayer(true);
      this.spawnBots(CONFIG.bots.defaultCount);
      this.spawner.seedInitial(this.allOrganisms());
      this.time = 0;
      this.bestSize = this.player.mass;
      this.ui.updateHUD();
    }

    startRun() {
      this.running = true;
      this.paused = false;
      this.resetWorld();
      this.audio.unlock();
      this.audio.setMuted(this.settings.muted);
    }

    totalEntities() {
      return (
        this.player.segments.length +
        this.bots.reduce((sum, bot) => sum + bot.segments.length, 0) +
        this.spawner.activeAmbientCount() +
        this.spawner.activeDropCount() +
        this.hazards.length
      );
    }

    botsAliveCount() {
      let count = 0;
      for (let i = 0; i < this.bots.length; i += 1) {
        if (this.bots[i].alive) {
          count += 1;
        }
      }
      return count;
    }

    allOrganisms() {
      return [this.player].concat(this.bots);
    }

    applyOrganismStyle(organism, styleIndex) {
      const index = Math.max(0, styleIndex | 0);
      const hue = ((168 + index * 137.508) % 360 + 360) % 360;
      const sat = clamp(62 + (index % 5) * 6, 58, 86);
      const light = clamp(57 + (index % 4) * 4, 54, 74);

      organism.baseHue = hue;
      organism.color = 'hsl(' + hue.toFixed(1) + ', ' + sat + '%, ' + light + '%)';
      organism.glow =
        'hsla(' +
        hue.toFixed(1) +
        ', ' +
        clamp(sat + 14, 68, 96) +
        '%, ' +
        clamp(light + 18, 66, 90) +
        '%, 0.92)';

      organism.patternType = index % 5;
      organism.primaryStride = 5 + (index % 6);
      organism.secondaryStride = 8 + ((index * 3) % 7);
      organism.saturationOffset = (index % 7) - 3;
      organism.luminanceOffset = ((index * 2) % 9) - 4;
      organism.featurePhase = (index * 1.37) % (Math.PI * 2);
    }

    spawnPlayer(fullReset) {
      const spawn = {
        x: CONFIG.world.width * 0.5,
        y: CONFIG.world.height * 0.5
      };
      this.player.spawnAt(spawn.x, spawn.y);
      this.applyOrganismStyle(this.player, 0);
      this.camera.x = spawn.x;
      this.camera.y = spawn.y;
      if (fullReset) {
        this.player.score = 0;
      }
    }

    spawnBots(count) {
      this.bots = [];
      const botCount = clamp(count, CONFIG.bots.minCount, CONFIG.bots.maxCount);

      for (let i = 0; i < botCount; i += 1) {
        const bot = new BotOrganism(CONFIG.player);
        this.applyOrganismStyle(bot, i + 1);
        bot.mass = rand(CONFIG.player.startMass * 0.9, CONFIG.player.startMass * 1.3);

        const spawn = this.findSafeSpawnPoint([this.player].concat(this.bots));
        bot.spawnAt(spawn.x, spawn.y);
        bot.mass = rand(CONFIG.player.startMass * 0.9, CONFIG.player.startMass * 1.2);
        bot.syncSegmentCount();
        this.bots.push(bot);
      }
    }

    findSafeSpawnPoint(existingOrganisms) {
      const organisms = Array.isArray(existingOrganisms) ? existingOrganisms : [];
      let best = null;
      let bestScore = -Infinity;
      let fallback = null;
      let fallbackScore = -Infinity;
      const attempts = CONFIG.spawn.attempts;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const point = {
          x: rand(100, CONFIG.world.width - 100),
          y: rand(100, CONFIG.world.height - 100)
        };

        const relax = attempt / Math.max(1, attempts - 1);
        const headClearance = lerp(CONFIG.spawn.headClearance, 100, relax);
        const segmentClearance = lerp(CONFIG.spawn.organismClearance, 130, relax);
        let minDistance = Infinity;
        let blocked = false;
        let penalty = 0;

        for (let i = 0; i < this.hazards.length; i += 1) {
          const hazard = this.hazards[i];
          const dist = Math.sqrt(sqrDistance(point.x, point.y, hazard.x, hazard.y));
          minDistance = Math.min(minDistance, dist - hazard.radius);
          if (dist < hazard.radius + 55) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          for (let i = 0; i < organisms.length; i += 1) {
            const organism = organisms[i];
            if (!organism || !organism.alive) {
              continue;
            }

            const headDist = Math.sqrt(
              sqrDistance(point.x, point.y, organism.head.x, organism.head.y)
            );
            minDistance = Math.min(minDistance, headDist);
            if (headDist < headClearance) {
              blocked = true;
              penalty += (headClearance - headDist) * 2.1;
              break;
            }

            const segmentStep = 6;
            for (let s = 0; s < organism.segments.length; s += segmentStep) {
              const segment = organism.segments[s];
              const segmentDist = Math.sqrt(
                sqrDistance(point.x, point.y, segment.x, segment.y)
              );
              minDistance = Math.min(minDistance, segmentDist);
              if (segmentDist < segmentClearance) {
                blocked = true;
                penalty += segmentClearance - segmentDist;
                break;
              }
            }

            if (blocked) {
              break;
            }
          }
        }

        const centerDistance = Math.sqrt(
          sqrDistance(point.x, point.y, CONFIG.world.width * 0.5, CONFIG.world.height * 0.5)
        );

        const score = minDistance + centerDistance * 0.1 - penalty + Math.random() * 24;

        if (score > fallbackScore) {
          fallbackScore = score;
          fallback = point;
        }

        if (blocked) {
          continue;
        }

        if (score > bestScore) {
          bestScore = score;
          best = point;
        }
      }

      if (best) {
        return best;
      }

      if (fallback) {
        return fallback;
      }

      return {
        x: CONFIG.world.width * 0.5,
        y: CONFIG.world.height * 0.5
      };
    }

    generateHazards() {
      const hazards = [];
      const centerX = CONFIG.world.width * 0.5;
      const centerY = CONFIG.world.height * 0.5;
      const centerSafeRadius = 220;

      const pushHazards = (kind, count, radiusRange) => {
        for (let i = 0; i < count; i += 1) {
          let placed = false;
          for (let attempt = 0; attempt < 40; attempt += 1) {
            const radius = rand(radiusRange[0], radiusRange[1]);
            const x = rand(80 + radius, CONFIG.world.width - (80 + radius));
            const y = rand(80 + radius, CONFIG.world.height - (80 + radius));

            if (sqrDistance(x, y, centerX, centerY) < (centerSafeRadius + radius) ** 2) {
              continue;
            }

            let overlap = false;
            for (let j = 0; j < hazards.length; j += 1) {
              const existing = hazards[j];
              const buffer = kind === 'viscosity' || existing.kind === 'viscosity' ? 38 : 22;
              const minDist = radius + existing.radius + buffer;
              if (sqrDistance(x, y, existing.x, existing.y) < minDist * minDist) {
                overlap = true;
                break;
              }
            }

            if (overlap) {
              continue;
            }

            hazards.push(new Hazard(kind, x, y, radius));
            placed = true;
            break;
          }

          if (!placed) {
            hazards.push(
              new Hazard(
                kind,
                rand(120, CONFIG.world.width - 120),
                rand(120, CONFIG.world.height - 120),
                rand(radiusRange[0], radiusRange[1])
              )
            );
          }
        }
      };

      pushHazards('debris', CONFIG.hazards.obstacles, CONFIG.hazards.obstacleRadius);
      pushHazards('toxic', CONFIG.hazards.toxicPatches, CONFIG.hazards.toxicRadius);
      pushHazards('viscosity', CONFIG.hazards.viscosityZones, CONFIG.hazards.viscosityRadius);

      return hazards;
    }

    getSlowFactorAt(x, y) {
      let slow = 1;
      for (let i = 0; i < this.hazards.length; i += 1) {
        const hazard = this.hazards[i];
        if (hazard.kind !== 'viscosity') {
          continue;
        }
        const dSq = sqrDistance(x, y, hazard.x, hazard.y);
        if (dSq <= hazard.radius * hazard.radius) {
          slow = Math.min(slow, 0.58);
        }
      }
      return slow;
    }

    updatePlayerAudioCues() {
      if (!this.player.alive || this.player.invulnerableTimer > 0) {
        this.playerInViscosity = false;
        return;
      }

      let inViscosity = false;
      let nearestLethalClearance = Infinity;

      for (let i = 0; i < this.hazards.length; i += 1) {
        const hazard = this.hazards[i];
        const dist = Math.sqrt(
          sqrDistance(this.player.head.x, this.player.head.y, hazard.x, hazard.y)
        );

        if (hazard.kind === 'viscosity') {
          if (dist <= hazard.radius) {
            inViscosity = true;
          }
          continue;
        }

        if (hazard.isLethal()) {
          const clearance = dist - hazard.radius - this.player.config.headRadius;
          if (clearance < nearestLethalClearance) {
            nearestLethalClearance = clearance;
          }
        }
      }

      if (inViscosity !== this.playerInViscosity) {
        this.audio.playViscosityCue(inViscosity);
        this.playerInViscosity = inViscosity;
      }

      if (nearestLethalClearance < 125) {
        const threat = clamp(1 - nearestLethalClearance / 125, 0, 1);
        this.audio.playLethalWarning(threat);
      }
    }

    killOrganism(organism, reason) {
      if (!organism.alive) {
        return;
      }

      this.spawner.spawnLysisDrops(organism);
      this.spawnDeathParticles(organism);
      organism.setDead(
        organism.isPlayer ? 2 : rand(CONFIG.bots.respawnMin, CONFIG.bots.respawnMax)
      );

      if (organism.isPlayer) {
        this.audio.playDeath(reason);
        this.ui.setGameOver(true, {
          size: Math.round(organism.mass),
          score: organism.score
        });
      }

      if (!organism.isPlayer && reason === 'body') {
        this.pingNearbyDrops(organism.head.x, organism.head.y);
      }
    }

    pingNearbyDrops(x, y) {
      for (let i = 0; i < 6; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const radius = rand(12, 36);
        this.spawner.spawnDrop('atp', x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 6);
      }
    }

    forcePlayerRespawn() {
      this.spawnPlayer(false);
      this.player.invulnerableTimer = CONFIG.player.spawnProtection;
      this.audio.playRespawn();
      this.ui.setGameOver(false);
    }

    spawnPickupParticles(collectible) {
      const quality = this.getEffectiveQuality();
      const amount = quality === 'high' ? CONFIG.rendering.particleSpawnCollect : 4;

      for (let i = 0; i < amount; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(20, 90);
        this.particles.spawn(
          collectible.x,
          collectible.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          rand(0.2, 0.5),
          rand(1.2, 2.8),
          collectible.color,
          collectible.glow
        );
      }
    }

    spawnDeathParticles(organism) {
      const quality = this.getEffectiveQuality();
      const count = quality === 'high' ? CONFIG.rendering.particleSpawnDeath : 20;

      for (let i = 0; i < count; i += 1) {
        const sample = organism.segments[randInt(0, Math.max(0, organism.segments.length - 1))];
        const angle = rand(0, Math.PI * 2);
        const speed = rand(40, 170);

        this.particles.spawn(
          sample.x,
          sample.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          rand(0.35, 0.95),
          rand(1.8, 3.8),
          organism.color,
          organism.glow
        );
      }
    }

    getEffectiveQuality() {
      if (this.settings.quality !== 'auto') {
        return this.settings.quality;
      }
      const lowFps = this.fps < 56;
      const heavyEntities = this.totalEntities() > CONFIG.rendering.adaptiveEntityLowThreshold;
      return lowFps || heavyEntities ? 'low' : 'high';
    }

    updateOrganism(organism, dt, desiredAngle, wantsBoost) {
      if (!organism.alive) {
        organism.respawnTimer -= dt;
        if (organism.respawnTimer <= 0) {
          const activeOthers = this
            .allOrganisms()
            .filter((candidate) => candidate.id !== organism.id && candidate.alive);
          const spawn = this.findSafeSpawnPoint(activeOthers);
          organism.spawnAt(spawn.x, spawn.y);
          if (organism.isPlayer) {
            this.audio.playRespawn();
            this.ui.setGameOver(false);
          }
        }
        return;
      }

      const slowFactor = this.getSlowFactorAt(organism.head.x, organism.head.y);
      const wasBoosting = organism.boosting;
      organism.updateMotion(dt, desiredAngle, wantsBoost, slowFactor);

      if (organism.isPlayer) {
        if (!wasBoosting && organism.boosting) {
          this.audio.playBoostStart();
        } else if (wasBoosting && !organism.boosting) {
          this.audio.playBoostStop();
        } else if (organism.boosting) {
          this.audio.playBoostPulse();
        }
      }

      organism.applyDriftDecay(this.time);
      this.bestSize = Math.max(this.bestSize, organism.isPlayer ? organism.mass : this.bestSize);
    }

    fixedUpdate(dt) {
      if (this.input.consumePausePressed() && this.running) {
        this.paused = !this.paused;
      }

      if (!this.running || this.paused) {
        return;
      }

      this.time += dt;
      this.updateAmbientMotes(dt);
      const organisms = this.allOrganisms();

      const playerIntent = this.input.getIntent(this.player, this.camera, this.viewport);
      this.updateOrganism(this.player, dt, playerIntent.desiredAngle, playerIntent.boost);
      this.updatePlayerAudioCues();

      this.collisions.buildHashes(organisms);

      for (let i = 0; i < this.bots.length; i += 1) {
        const bot = this.bots[i];
        this.ai.updateBot(bot, dt);
        const desiredAngle = Math.atan2(
          wrappedDeltaY(bot.targetY, bot.head.y),
          wrappedDeltaX(bot.targetX, bot.head.x)
        );
        this.updateOrganism(bot, dt, desiredAngle, bot.wantsBoost);
      }

      this.collisions.buildHashes(organisms);
      this.collisions.applyCollisions(organisms);

      this.spawner.update(dt, organisms);
      this.particles.update(dt);

      const targetX = this.player.head.x;
      const targetY = this.player.head.y;
      this.camera.x = wrapCoordinate(
        this.camera.x + wrappedDeltaX(targetX, this.camera.x) * CONFIG.camera.followSmoothing,
        WORLD_WIDTH
      );
      this.camera.y = wrapCoordinate(
        this.camera.y + wrappedDeltaY(targetY, this.camera.y) * CONFIG.camera.followSmoothing,
        WORLD_HEIGHT
      );
      this.clampCamera();

      this.ui.updateHUD();
    }

    clampCamera() {
      this.camera.x = wrapCoordinate(this.camera.x, WORLD_WIDTH);
      this.camera.y = wrapCoordinate(this.camera.y, WORLD_HEIGHT);
    }

    frame(timestamp) {
      if (!this.lastFrame) {
        this.lastFrame = timestamp;
      }

      const dt = Math.min(CONFIG.simulation.maxFrame, (timestamp - this.lastFrame) / 1000);
      this.lastFrame = timestamp;
      this.fps = lerp(this.fps, 1 / Math.max(0.0001, dt), CONFIG.simulation.fpsSmoothing);
      this.accumulator += dt;

      while (this.accumulator >= CONFIG.simulation.step) {
        this.fixedUpdate(CONFIG.simulation.step);
        this.accumulator -= CONFIG.simulation.step;
      }

      this.render();
      requestAnimationFrame((time) => this.frame(time));
    }

    worldToScreen(x, y) {
      return {
        x: wrappedDeltaX(x, this.camera.x) * this.camera.zoom + this.viewport.width * 0.5,
        y: wrappedDeltaY(y, this.camera.y) * this.camera.zoom + this.viewport.height * 0.5
      };
    }

    renderBackground(ctx, quality) {
      const width = this.viewport.width;
      const height = this.viewport.height;
      const rich = quality === 'high';

      ctx.fillStyle = '#04111a';
      ctx.fillRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(
        width * 0.54 + Math.sin(this.time * 0.06) * width * 0.04,
        height * 0.44 + Math.cos(this.time * 0.05) * height * 0.03,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.56,
        Math.max(width, height) * 0.9
      );
      gradient.addColorStop(0, '#1b557f');
      gradient.addColorStop(0.34, '#113553');
      gradient.addColorStop(1, '#04101b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const secondary = ctx.createRadialGradient(
        width * 0.18,
        height * 0.22,
        0,
        width * 0.18,
        height * 0.22,
        Math.max(width, height) * 0.62
      );
      secondary.addColorStop(0, 'rgba(138, 204, 226, 0.14)');
      secondary.addColorStop(1, 'rgba(138, 204, 226, 0)');
      ctx.fillStyle = secondary;
      ctx.fillRect(0, 0, width, height);

      if (rich) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = 'rgba(166, 226, 246, 0.26)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i += 1) {
          const y = height * (0.3 + i * 0.26) + Math.sin(this.time * (0.18 + i * 0.07)) * 10;
          ctx.beginPath();
          ctx.moveTo(-40, y);
          ctx.bezierCurveTo(width * 0.28, y - 20, width * 0.7, y + 20, width + 40, y - 4);
          ctx.stroke();
        }
      }

      const cloudCap = rich ? this.backgroundClouds.length : Math.floor(this.backgroundClouds.length * 0.6);
      for (let i = 0; i < cloudCap; i += 1) {
        const cloud = this.backgroundClouds[i];
        const virtualCamX = wrapCoordinate(this.camera.x * cloud.parallax, WORLD_WIDTH);
        const virtualCamY = wrapCoordinate(this.camera.y * cloud.parallax, WORLD_HEIGHT);
        const sx = wrappedDeltaX(cloud.x, virtualCamX) * this.camera.zoom + width * 0.5;
        const sy = wrappedDeltaY(cloud.y, virtualCamY) * this.camera.zoom + height * 0.5;
        const radius = cloud.radius * this.camera.zoom;

        if (sx < -radius || sy < -radius || sx > width + radius || sy > height + radius) {
          continue;
        }

        ctx.globalAlpha = cloud.alpha;
        ctx.fillStyle = cloud.colorMain;
        ctx.beginPath();
        ctx.ellipse(
          sx,
          sy + Math.sin(this.time * 0.2 + cloud.drift) * 6,
          radius * cloud.stretch,
          radius * 0.66,
          cloud.drift * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (rich) {
          ctx.globalAlpha = cloud.alpha * 0.58;
          ctx.fillStyle = cloud.colorHighlight;
          ctx.beginPath();
          ctx.ellipse(
            sx - radius * 0.2,
            sy - radius * 0.12,
            radius * cloud.stretch * 0.46,
            radius * 0.24,
            cloud.drift * 0.4,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      const dotCap = rich ? this.backgroundStars.length : Math.floor(this.backgroundStars.length * 0.55);
      for (let i = 0; i < dotCap; i += 1) {
        const dot = this.backgroundStars[i];
        const parallax = dot.kind === 'speck' ? 0.2 : dot.kind === 'spike' ? 0.16 : 0.12;
        const virtualCamX = wrapCoordinate(this.camera.x * parallax, WORLD_WIDTH);
        const virtualCamY = wrapCoordinate(this.camera.y * parallax, WORLD_HEIGHT);
        const sx = wrappedDeltaX(dot.x, virtualCamX) * this.camera.zoom + width * 0.5;
        const sy = wrappedDeltaY(dot.y, virtualCamY) * this.camera.zoom + height * 0.5;

        if (sx < -8 || sy < -8 || sx > width + 8 || sy > height + 8) {
          continue;
        }

        ctx.globalAlpha = dot.alpha * (0.7 + Math.sin(this.time * dot.pulse + i * 0.04) * 0.3);
        if (dot.kind === 'bubble') {
          ctx.fillStyle = dot.colorSoft;
          ctx.strokeStyle = dot.stroke;
          ctx.beginPath();
          ctx.ellipse(sx, sy, dot.size * 1.4, dot.size * 1.1, dot.rotation, 0, Math.PI * 2);
          ctx.fill();
          if (rich) {
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        } else if (dot.kind === 'organelle') {
          ctx.fillStyle = dot.colorMid;
          ctx.beginPath();
          ctx.ellipse(sx, sy, dot.size * 1.3, dot.size * dot.stretch, dot.rotation, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = dot.colorBright;
          ctx.beginPath();
          ctx.arc(sx, sy, dot.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    renderCanopyLight(ctx, quality) {
      if (quality === 'low') {
        return;
      }

      const width = this.viewport.width;
      const height = this.viewport.height;

      for (let i = 0; i < this.canopyRays.length; i += 1) {
        const ray = this.canopyRays[i];
        const sway = Math.sin(this.time * ray.speed + ray.sway * 2.6) * 0.03;
        const x = (ray.x + sway) * width;
        const halfWidth = ray.width * width;
        const grad = ctx.createLinearGradient(x, 0, x + halfWidth * 0.2, height);
        grad.addColorStop(0, 'rgba(176, 240, 255, 0)');
        grad.addColorStop(0.36, 'rgba(176, 240, 255, ' + ray.alpha.toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(176, 240, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - halfWidth, -30);
        ctx.lineTo(x + halfWidth, -30);
        ctx.lineTo(x + halfWidth * 0.35, height + 30);
        ctx.lineTo(x - halfWidth * 0.35, height + 30);
        ctx.closePath();
        ctx.fill();
      }
    }

    renderGroundDetails(ctx, quality) {
      const width = this.viewport.width;
      const height = this.viewport.height;
      const step = quality === 'high' ? 1 : 2;

      for (let i = 0; i < this.groundDetails.length; i += step) {
        const item = this.groundDetails[i];
        const pos = this.worldToScreen(item.x, item.y);
        const sx = pos.x;
        const sy = pos.y;
        const scale = this.camera.zoom;
        const size = item.size * scale;

        if (sx < -60 || sy < -60 || sx > width + 60 || sy > height + 60) {
          continue;
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(item.rotation + Math.sin(this.time * 0.12 + item.wobble) * 0.04);
        ctx.globalAlpha = item.alpha * (quality === 'high' ? 1 : 0.7);

        if (item.type === 'fiber') {
          ctx.strokeStyle = item.strokeFiber;
          ctx.lineWidth = Math.max(1, size * 0.12);
          ctx.beginPath();
          ctx.moveTo(-size * 0.8, 0);
          ctx.lineTo(size * 0.85, 0);
          ctx.stroke();
          if (quality === 'high') {
            ctx.beginPath();
            ctx.moveTo(-size * 0.2, 0);
            ctx.lineTo(-size * 0.05, -size * 0.22);
            ctx.moveTo(size * 0.16, 0);
            ctx.lineTo(size * 0.36, size * 0.2);
            ctx.stroke();
          }
        } else if (item.type === 'membrane') {
          ctx.strokeStyle = item.strokeMembrane;
          ctx.lineWidth = Math.max(1, size * 0.09);
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.7, size * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (quality === 'high') {
            ctx.beginPath();
            ctx.moveTo(-size * 0.55, 0);
            ctx.lineTo(size * 0.55, 0);
            ctx.stroke();
          }
        } else if (item.type === 'crystal') {
          ctx.fillStyle = item.fillCrystal;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.52, size * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = item.strokeCrystal;
          ctx.lineWidth = Math.max(1, size * 0.06);
          ctx.beginPath();
          ctx.moveTo(-size * 0.32, -size * 0.05);
          ctx.lineTo(size * 0.32, size * 0.05);
          ctx.stroke();
        } else if (item.type === 'plankton') {
          ctx.fillStyle = item.fillPlankton;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.38, size * 0.26, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'diatom') {
          ctx.strokeStyle = item.strokeDiatom;
          ctx.lineWidth = Math.max(1, size * 0.08);
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (quality === 'high') {
            for (let rib = -2; rib <= 2; rib += 1) {
              const x = rib * size * 0.16;
              ctx.beginPath();
              ctx.moveTo(x, -size * 0.16);
              ctx.lineTo(x, size * 0.16);
              ctx.stroke();
            }
          }
        } else {
          ctx.fillStyle = item.fillColony;
          for (let c = 0; c < 4; c += 1) {
            const angle = c * 1.4 + item.wobble;
            ctx.beginPath();
            ctx.arc(
              Math.cos(angle) * size * 0.26,
              Math.sin(angle) * size * 0.18,
              size * 0.16,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }

        ctx.restore();
      }

      ctx.globalAlpha = 1;
    }

    renderWorldBounds(ctx) {
      // Endless mode has no visible arena boundary.
    }

    drawMudHazard(ctx, hazard, pos, radius, quality) {
      const pulse = 1 + Math.sin(this.time * (0.9 + hazard.wobble * 0.2) + hazard.phase) * 0.06;
      const points = quality === 'high' ? 17 : 11;
      const palette =
        hazard.variant === 0
          ? ['rgba(76, 161, 190, 0.68)', 'rgba(45, 112, 145, 0.74)', 'rgba(166, 241, 248, 0.28)']
          : hazard.variant === 1
            ? ['rgba(94, 171, 186, 0.66)', 'rgba(59, 121, 136, 0.76)', 'rgba(186, 251, 232, 0.24)']
            : ['rgba(82, 151, 177, 0.68)', 'rgba(37, 89, 132, 0.78)', 'rgba(178, 238, 255, 0.24)'];

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(hazard.rotation + Math.sin(hazard.y * 0.003 + this.time * 0.2) * 0.12);

      ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const angle = (i / points) * Math.PI * 2;
        const wobble =
          0.82 +
          Math.sin(angle * 4 + hazard.x * 0.01 + this.time * 0.26) * 0.12 +
          Math.cos(angle * 3 + hazard.y * 0.01) * 0.06;
        const r = radius * wobble * pulse;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      const gelGradient = ctx.createRadialGradient(
        -radius * 0.24,
        -radius * 0.3,
        radius * 0.16,
        0,
        0,
        radius * 1.05
      );
      gelGradient.addColorStop(0, palette[2]);
      gelGradient.addColorStop(0.44, palette[0]);
      gelGradient.addColorStop(1, palette[1]);
      ctx.fillStyle = gelGradient;
      ctx.fill();

      ctx.strokeStyle = 'rgba(188, 252, 255, 0.46)';
      ctx.lineWidth = Math.max(2.4, radius * 0.095);
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.fillStyle = 'rgba(209, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.2, -radius * 0.2, radius * 0.4, radius * 0.22, -0.32, 0, Math.PI * 2);
      ctx.fill();

      if (quality === 'high') {
        for (let ripple = 0; ripple < 3; ripple += 1) {
          const grow = 0.24 + ripple * 0.22 + Math.sin(this.time * 1.4 + ripple + hazard.phase) * 0.03;
          ctx.strokeStyle = 'rgba(189, 247, 255, 0.2)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * grow * 1.3, radius * grow, 0.24, 0, Math.PI * 2);
          ctx.stroke();
        }

        const bubbles = hazard.variant === 2 ? 4 : 3;
        for (let i = 0; i < bubbles; i += 1) {
          const a = (i / bubbles) * Math.PI * 2 + hazard.phase;
          const d = radius * (0.35 + (i % 2) * 0.16);
          ctx.fillStyle = 'rgba(212, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(
            Math.cos(a) * d,
            Math.sin(a * 1.2 + this.time * 0.6) * d * 0.52,
            radius * (0.08 + i * 0.01),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      ctx.restore();
    }

    drawPredatorHazard(ctx, hazard, pos, radius, quality) {
      const bob = Math.sin(this.time * 1.5 + hazard.phase) * radius * 0.05;
      const bodyRadius = radius * (hazard.kind === 'toxic' ? 1.02 : 0.96);
      const isToxic = hazard.kind === 'toxic';

      ctx.save();
      ctx.translate(pos.x, pos.y + bob);
      ctx.rotate(hazard.rotation * 0.4 + Math.sin(this.time * 0.6 + hazard.phase) * 0.07);

      ctx.fillStyle = 'rgba(5, 16, 26, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, radius * 0.75, bodyRadius * 0.86, bodyRadius * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      const membrane = ctx.createLinearGradient(0, -bodyRadius, 0, bodyRadius);
      if (isToxic) {
        membrane.addColorStop(0, 'rgba(237, 244, 246, 0.96)');
        membrane.addColorStop(0.42, 'rgba(188, 210, 220, 0.96)');
        membrane.addColorStop(1, 'rgba(118, 152, 170, 0.98)');
      } else {
        membrane.addColorStop(0, 'rgba(224, 238, 248, 0.94)');
        membrane.addColorStop(0.4, 'rgba(172, 198, 220, 0.96)');
        membrane.addColorStop(1, 'rgba(108, 143, 170, 0.98)');
      }
      ctx.fillStyle = membrane;
      ctx.beginPath();
      if (hazard.variant === 0) {
        ctx.ellipse(0, 0, bodyRadius * 0.95, bodyRadius * 0.74, 0, 0, Math.PI * 2);
      } else {
        const points = hazard.variant === 1 ? 12 : 15;
        for (let i = 0; i <= points; i += 1) {
          const a = (i / points) * Math.PI * 2;
          const ripple = 0.9 + Math.sin(a * (hazard.variant === 1 ? 4 : 6) + this.time * 0.8 + hazard.phase) * 0.08;
          const rx = Math.cos(a) * bodyRadius * 0.95 * ripple;
          const ry = Math.sin(a) * bodyRadius * 0.74 * ripple;
          if (i === 0) {
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
        ctx.closePath();
      }
      ctx.fill();

      ctx.strokeStyle = isToxic ? 'rgba(247, 252, 255, 0.78)' : 'rgba(220, 238, 255, 0.75)';
      ctx.lineWidth = Math.max(2.4, radius * 0.1);
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyRadius * 0.95, bodyRadius * 0.74, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (quality === 'high') {
        const cilia = isToxic ? 16 : 22;
        for (let i = 0; i < cilia; i += 1) {
          const a = (i / cilia) * Math.PI * 2;
          const ex = Math.cos(a) * bodyRadius * 0.95;
          const ey = Math.sin(a) * bodyRadius * 0.74;
          const wave = Math.sin(this.time * (isToxic ? 2.8 : 4) + i * 0.7 + hazard.phase) * radius * 0.05;
          const reach = isToxic ? radius * 0.12 : radius * 0.16;
          const ox = Math.cos(a) * (reach + wave);
          const oy = Math.sin(a) * (reach + wave);
          ctx.strokeStyle = isToxic ? 'rgba(236, 247, 255, 0.5)' : 'rgba(204, 236, 252, 0.56)';
          ctx.lineWidth = Math.max(0.9, radius * 0.035);
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + ox, ey + oy);
          ctx.stroke();
        }
      }

      ctx.fillStyle = 'rgba(242, 251, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.2, -radius * 0.22, radius * 0.34, radius * 0.18, -0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isToxic ? 'rgba(255, 210, 120, 0.72)' : 'rgba(255, 226, 156, 0.68)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.08, radius * 0.08, radius * 0.24, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isToxic ? 'rgba(251, 186, 98, 0.86)' : 'rgba(250, 202, 130, 0.76)';
      ctx.lineWidth = Math.max(1.2, radius * 0.05);
      ctx.stroke();

      ctx.fillStyle = isToxic ? 'rgba(255, 178, 162, 0.36)' : 'rgba(208, 228, 255, 0.34)';
      for (let vac = 0; vac < 4; vac += 1) {
        const angle = vac * 1.6 + this.time * 0.4 + hazard.phase;
        const vx = Math.cos(angle) * radius * 0.28;
        const vy = Math.sin(angle * 1.2) * radius * 0.16 - radius * 0.1;
        ctx.beginPath();
        ctx.ellipse(vx, vy, radius * 0.12, radius * 0.065, angle * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    renderHazards(ctx, quality) {
      for (let i = 0; i < this.hazards.length; i += 1) {
        const hazard = this.hazards[i];
        const pos = this.worldToScreen(hazard.x, hazard.y);
        const radius = hazard.radius * this.camera.zoom;

        if (pos.x + radius < 0 || pos.y + radius < 0 || pos.x - radius > this.viewport.width || pos.y - radius > this.viewport.height) {
          continue;
        }

        if (hazard.kind === 'viscosity') {
          this.drawMudHazard(ctx, hazard, pos, radius, quality);
        } else {
          this.drawPredatorHazard(ctx, hazard, pos, radius, quality);
        }
      }
    }

    renderCollectibles(ctx, quality) {
      const fancy = quality === 'high' && this.fps > 57;
      const blur = fancy ? CONFIG.rendering.shadowBlurHigh : CONFIG.rendering.shadowBlurLow;

      const drawOne = (collectible) => {
        if (!collectible.active) {
          return;
        }
        const pos = this.worldToScreen(collectible.x, collectible.y);
        const pulse = 1 + Math.sin((this.time + collectible.spawnTime) * collectible.pulseRate) * 0.08;
        const radius = collectible.radius * this.camera.zoom * pulse;
        const spin = collectible.spin + this.time * (0.6 + collectible.orbit);

        if (pos.x + radius < -20 || pos.y + radius < -20 || pos.x - radius > this.viewport.width + 20 || pos.y - radius > this.viewport.height + 20) {
          return;
        }

        ctx.fillStyle = collectible.color;
        ctx.shadowColor = collectible.glow;
        ctx.shadowBlur = blur;
        ctx.globalAlpha = collectible.isDrop ? 0.92 : 0.82;

        if (!fancy) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(spin);

        if (collectible.kind === 'glucose') {
          if (collectible.shape === 0) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
          } else if (collectible.shape === 1) {
            const sides = 6;
            ctx.beginPath();
            for (let i = 0; i <= sides; i += 1) {
              const a = (i / sides) * Math.PI * 2;
              const x = Math.cos(a) * radius;
              const y = Math.sin(a) * radius;
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.2, radius * 0.72, 0.24, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(radius * 0.18, 0, radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (collectible.kind === 'amino') {
          if (collectible.shape === 0) {
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.28, radius * 0.86, 0.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (collectible.shape === 1) {
            ctx.beginPath();
            ctx.arc(-radius * 0.34, 0, radius * 0.64, 0, Math.PI * 2);
            ctx.arc(radius * 0.34, 0, radius * 0.64, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(-radius * 1.08, 0);
            ctx.quadraticCurveTo(-radius * 0.2, -radius * 0.86, radius * 1.08, 0);
            ctx.quadraticCurveTo(radius * 0.18, radius * 0.84, -radius * 1.08, 0);
            ctx.fill();
          }
        } else if (collectible.kind === 'atp') {
          if (collectible.shape === 0) {
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
            ctx.fill();
          } else if (collectible.shape === 1) {
            for (let i = 0; i < 3; i += 1) {
              const a = i * ((Math.PI * 2) / 3);
              ctx.beginPath();
              ctx.arc(Math.cos(a) * radius * 0.48, Math.sin(a) * radius * 0.48, radius * 0.45, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 0.62, radius * 1.12, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          if (collectible.shape === 0) {
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(0, -radius);
            ctx.lineTo(radius * 0.74, 0);
            ctx.lineTo(0, radius);
            ctx.lineTo(-radius * 0.74, 0);
            ctx.closePath();
            ctx.fill();
          }
        }

        ctx.globalAlpha = collectible.isDrop ? 0.55 : 0.42;
        ctx.strokeStyle = 'rgba(198, 244, 255, 0.45)';
        ctx.lineWidth = Math.max(0.8, radius * 0.12);
        if (collectible.kind === 'amino') {
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 1.34, radius * 0.92, 0.18, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.24, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      };

      for (let i = 0; i < this.spawner.collectibles.length; i += 1) {
        drawOne(this.spawner.collectibles[i]);
      }

      for (let i = 0; i < this.spawner.dropPool.length; i += 1) {
        drawOne(this.spawner.dropPool[i]);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    renderOrganism(ctx, organism, quality) {
      if (!organism.alive) {
        return;
      }

      const blur = quality === 'high' ? CONFIG.rendering.shadowBlurHigh : 0;
      const alpha = organism.invulnerableTimer > 0 ? 0.58 : 0.96;
      const segmentCount = organism.segments.length;

      if (segmentCount > 3) {
        ctx.globalAlpha = alpha * 0.18;
        ctx.strokeStyle = organism.isPlayer ? 'rgba(20, 74, 86, 0.5)' : 'rgba(27, 53, 74, 0.42)';
        ctx.lineWidth = organism.segments[0]._radius * this.camera.zoom * 1.52;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const start = this.worldToScreen(organism.segments[0].x + 5, organism.segments[0].y + 7);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < segmentCount; i += 1) {
          const p = this.worldToScreen(organism.segments[i].x + 5, organism.segments[i].y + 7);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      for (let i = segmentCount - 1; i >= 0; i -= 1) {
        const segment = organism.segments[i];
        const pos = this.worldToScreen(segment.x, segment.y);
        const radius = segment._radius * this.camera.zoom;

        if (pos.x + radius < -30 || pos.y + radius < -30 || pos.x - radius > this.viewport.width + 30 || pos.y - radius > this.viewport.height + 30) {
          continue;
        }

        const t = i / Math.max(1, segmentCount - 1);
        const saturation = (organism.isPlayer ? 74 : 62) + organism.saturationOffset;
        const luminance = (organism.isPlayer ? 72 : 66) + organism.luminanceOffset - t * (organism.isPlayer ? 20 : 14);
        ctx.fillStyle = 'hsl(' + organism.baseHue + ', ' + saturation + '%, ' + luminance + '%)';
        ctx.globalAlpha = alpha;
        ctx.shadowColor = organism.glow;
        ctx.shadowBlur = blur;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (quality === 'high' && i % organism.primaryStride === 0 && i > 2) {
          if (organism.patternType === 1) {
            ctx.fillStyle = organism.isPlayer ? 'rgba(214, 255, 244, 0.76)' : 'rgba(208, 234, 255, 0.54)';
          } else if (organism.patternType === 2) {
            ctx.fillStyle = organism.isPlayer ? 'rgba(255, 233, 186, 0.62)' : 'rgba(244, 220, 255, 0.54)';
          } else if (organism.patternType === 3) {
            ctx.fillStyle = organism.isPlayer ? 'rgba(188, 253, 255, 0.68)' : 'rgba(182, 221, 255, 0.5)';
          } else {
            ctx.fillStyle = organism.isPlayer ? 'rgba(255, 226, 166, 0.56)' : 'rgba(255, 214, 236, 0.48)';
          }
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(
            pos.x + Math.cos(organism.featurePhase + i * 0.2) * radius * 0.28,
            pos.y - radius * 0.18,
            radius * 0.28,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        if (quality === 'high' && i % organism.secondaryStride === 0 && i > 1 && i < segmentCount - 1) {
          if (organism.patternType === 2) {
            ctx.strokeStyle = organism.isPlayer ? 'rgba(184, 249, 255, 0.48)' : 'rgba(163, 198, 241, 0.42)';
            ctx.lineWidth = Math.max(1, radius * 0.08);
            ctx.beginPath();
            ctx.moveTo(pos.x - radius * 0.46, pos.y);
            ctx.lineTo(pos.x + radius * 0.46, pos.y);
            ctx.stroke();
          } else if (organism.patternType === 3) {
            ctx.fillStyle = organism.isPlayer ? 'rgba(255, 216, 156, 0.45)' : 'rgba(230, 205, 255, 0.38)';
            ctx.beginPath();
            ctx.ellipse(pos.x, pos.y + radius * 0.02, radius * 0.18, radius * 0.56, 1.57, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = organism.isPlayer ? 'rgba(255, 210, 150, 0.5)' : 'rgba(255, 194, 216, 0.42)';
            ctx.beginPath();
            ctx.ellipse(pos.x - radius * 0.08, pos.y + radius * 0.06, radius * 0.34, radius * 0.22, 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const head = organism.segments[0];
      const headPos = this.worldToScreen(head.x, head.y);
      const headRadius = head._radius * this.camera.zoom;
      ctx.fillStyle = organism.isPlayer ? '#d7fff2' : '#d6e9ff';
      ctx.globalAlpha = alpha;
      ctx.shadowColor = organism.isPlayer ? '#7be6da' : '#94b7ff';
      ctx.shadowBlur = blur + 2;
      ctx.beginPath();
      ctx.arc(headPos.x, headPos.y, headRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      if (organism.isPlayer) {
        ctx.strokeStyle = 'rgba(152, 246, 231, 0.95)';
        ctx.lineWidth = Math.max(1.8, this.camera.zoom * 1.9);
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, headRadius * 1.05, 0, Math.PI * 2);
        ctx.stroke();

        if (quality === 'high') {
          const side = headRadius * 0.82;
          ctx.strokeStyle = 'rgba(188, 255, 242, 0.76)';
          ctx.lineWidth = Math.max(1, this.camera.zoom * 1.2);
          ctx.beginPath();
          ctx.moveTo(
            headPos.x - Math.cos(organism.angle + 0.7) * side,
            headPos.y - Math.sin(organism.angle + 0.7) * side
          );
          ctx.quadraticCurveTo(
            headPos.x - Math.cos(organism.angle + 1.15) * side * 1.35,
            headPos.y - Math.sin(organism.angle + 1.15) * side * 1.35,
            headPos.x - Math.cos(organism.angle + 1.75) * side * 1.28,
            headPos.y - Math.sin(organism.angle + 1.75) * side * 1.28
          );
          ctx.moveTo(
            headPos.x - Math.cos(organism.angle - 0.7) * side,
            headPos.y - Math.sin(organism.angle - 0.7) * side
          );
          ctx.quadraticCurveTo(
            headPos.x - Math.cos(organism.angle - 1.15) * side * 1.35,
            headPos.y - Math.sin(organism.angle - 1.15) * side * 1.35,
            headPos.x - Math.cos(organism.angle - 1.75) * side * 1.28,
            headPos.y - Math.sin(organism.angle - 1.75) * side * 1.28
          );
          ctx.stroke();
        }
      } else if (quality === 'high') {
        ctx.strokeStyle = 'rgba(128, 168, 228, 0.42)';
        ctx.lineWidth = Math.max(1, this.camera.zoom * 1.2);
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, headRadius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    renderAmbientMotes(ctx, quality) {
      const width = this.viewport.width;
      const height = this.viewport.height;
      const cap = quality === 'high' ? this.ambientMotes.length : Math.floor(this.ambientMotes.length * 0.45);

      for (let i = 0; i < cap; i += 1) {
        const mote = this.ambientMotes[i];
        const flicker = 0.7 + Math.sin(mote.twinkle) * 0.3;
        ctx.globalAlpha = mote.alpha * flicker;
        ctx.fillStyle = mote.warm ? 'rgba(255, 220, 164, 0.74)' : 'rgba(182, 240, 255, 0.74)';
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (quality === 'high') {
        const haze = ctx.createLinearGradient(0, height * 0.45, 0, height);
        haze.addColorStop(0, 'rgba(164, 232, 255, 0)');
        haze.addColorStop(1, 'rgba(12, 42, 68, 0.2)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.globalAlpha = 1;
    }

    renderVignette(ctx) {
      const width = this.viewport.width;
      const height = this.viewport.height;
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.2,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(3, 10, 18, 0.42)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    renderPauseLabel(ctx) {
      if (!this.paused || !this.running) {
        return;
      }

      ctx.fillStyle = 'rgba(2, 10, 13, 0.52)';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#d7f9ff';
      ctx.font = '700 36px \"Syne\", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Simulation Paused', this.viewport.width * 0.5, this.viewport.height * 0.5);
      ctx.font = '600 17px Chivo, sans-serif';
      ctx.fillStyle = '#98cbe0';
      ctx.fillText('Press Escape to resume', this.viewport.width * 0.5, this.viewport.height * 0.5 + 30);
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

      const quality = this.getEffectiveQuality();

      this.renderBackground(ctx, quality);
      this.renderCanopyLight(ctx, quality);
      this.renderGroundDetails(ctx, quality);
      this.renderHazards(ctx, quality);
      this.renderCollectibles(ctx, quality);

      for (let i = 0; i < this.bots.length; i += 1) {
        this.renderOrganism(ctx, this.bots[i], quality);
      }
      this.renderOrganism(ctx, this.player, quality);

      this.particles.draw(ctx, this.camera, quality, this.viewport.width, this.viewport.height);
      this.renderAmbientMotes(ctx, quality);
      this.renderVignette(ctx);
      this.renderPauseLabel(ctx);
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    try {
      new Game();
    } catch (error) {
      console.error('Microcosm failed to start:', error);
      const fallback = document.createElement('div');
      fallback.style.position = 'fixed';
      fallback.style.inset = '0';
      fallback.style.display = 'grid';
      fallback.style.placeItems = 'center';
      fallback.style.background = 'radial-gradient(circle at 50% 40%, #082130, #020910)';
      fallback.style.color = '#d7f9ff';
      fallback.style.font = '600 16px Chivo, sans-serif';
      fallback.style.textAlign = 'center';
      fallback.style.padding = '24px';
      fallback.style.zIndex = '9999';
      const message = document.createElement('div');
      message.innerHTML =
        '<h2 style="margin:0 0 10px;font:700 26px Syne,sans-serif;">Microcosm Error</h2>' +
        '<p style="margin:0 0 10px;opacity:.9;">The game failed to initialize.</p>' +
        '<p style="margin:0;opacity:.72;font-size:13px;">Try a hard refresh or update to the latest game.js.</p>';
      fallback.appendChild(message);
      document.body.appendChild(fallback);
    }
  });
})();

(() => {
  'use strict';

  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  const stage = document.querySelector('.game-stage');
  const hud = document.querySelector('#game-hud');
  const crashWarning = document.querySelector('#crash-warning');
  const screens = {
    menu: document.querySelector('#menu-screen'),
    how: document.querySelector('#how-screen'),
    paused: document.querySelector('#pause-screen'),
    gameover: document.querySelector('#gameover-screen')
  };
  const ui = {
    score: document.querySelector('#score-value'),
    highScore: document.querySelector('#high-score-value'),
    menuHighScore: document.querySelector('#menu-high-score'),
    finalScore: document.querySelector('#final-score'),
    finalHighScore: document.querySelector('#final-high-score'),
    speed: document.querySelector('#speed-value')
  };

  const HIGH_SCORE_KEY = 'street-racer-high-score';
  const SOUND_ENABLED_KEY = 'street-racer-sound-enabled';
  const trafficColors = ['#ef554a', '#42a6cd', '#e9bc43', '#b5d6d5', '#ae72d0', '#4fbd84'];
  const trafficSpecs = {
    car: { width: .5, length: 1.62, speed: 1, windows: 0 },
    wide: { width: .53, length: 1.64, speed: .98, windows: 0 },
    large: { width: .55, length: 1.68, speed: .94, windows: 0 },
    truck: { width: .56, length: 1.7, speed: .88, windows: 0 },
    van: { width: .54, length: 1.66, speed: .92, windows: 1 },
    minibus: { width: .57, length: 1.72, speed: .86, windows: 3 },
    bus: { width: .59, length: 1.78, speed: .8, windows: 5 }
  };
  const trafficRoster = ['car', 'car', 'car', 'wide', 'large', 'truck', 'van', 'minibus', 'bus', 'bus'];
  const minimumSpeed = 84;
  const maximumSpeed = 150;
  const jumpRiseDuration = .16;
  const jumpHoldDuration = .12;
  const jumpFallDuration = .18;
  const state = {
    mode: 'menu',
    score: 0,
    highScore: loadHighScore(),
    elapsed: 0,
    difficulty: 0,
    roadOffset: 0,
    spawnTimer: 0,
    lastSpawnLane: null,
    recentTrafficTypes: [],
    lastFrame: 0,
    animationId: 0,
    crashEffect: null,
    gestureStart: null,
    objects: [],
    pedestrians: [],
    pedestrianSpawnTimer: 0,
    player: { lane: 1, x: 0, targetX: 0, jumpTime: -1, jumpPeakHeight: 0, jumpFallTime: -1, jumpTarget: null },
    width: 0,
    height: 0,
    laneWidth: 0,
    scale: 1,
    roadLeft: 0,
    roadWidth: 0,
      soundEnabled: loadSoundPreference()
  };

  function loadHighScore() {
    try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; }
    catch { return 0; }
  }

  function saveHighScore() {
    try { localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore)); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }

  function loadSoundPreference() {
    try {
      const preference = localStorage.getItem(SOUND_ENABLED_KEY);
      return preference === null ? true : preference === 'true';
    } catch { return true; }
  }

  function saveSoundPreference() {
    try { localStorage.setItem(SOUND_ENABLED_KEY, String(state.soundEnabled)); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(value)).toString().padStart(4, '0');
  }

  function calculateDifficulty() {
    const timeProgress = Math.min(1, state.elapsed / 300);
    const scoreProgress = Math.min(1, state.score / 6000);
    return Math.min(1, timeProgress * .2 + scoreProgress * .8);
  }

  function updateHud() {
    ui.score.textContent = formatScore(state.score);
    ui.highScore.textContent = formatScore(state.highScore);
    ui.menuHighScore.textContent = formatScore(state.highScore);
    ui.speed.textContent = String(Math.round(minimumSpeed + state.difficulty * (maximumSpeed - minimumSpeed))).padStart(3, '0');
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      if (!screen) return;
      const active = key === name;
      screen.hidden = !active;
      screen.classList.toggle('is-visible', active);
    });
  }

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    state.roadWidth = state.width * 0.62;
    state.roadLeft = (state.width - state.roadWidth) / 2;
    state.laneWidth = state.roadWidth / 3;
    state.scale = state.laneWidth / 100;
    state.player.x = laneCenter(state.player.lane);
    state.player.targetX = state.player.x;
    resetPedestrians();
    drawScene(0);
  }

  function laneCenter(lane) {
    return state.roadLeft + state.laneWidth * (lane + 0.5);
  }

  function drawScene(deltaSeconds) {
    const width = state.width;
    const height = state.height;
    if (!width || !height) return;
    drawScenery(width, height);
    drawRoad(width, height);
    drawPedestrians();
    if (state.mode !== 'gameover') {
      state.objects.forEach(drawTraffic);
      drawPlayer();
    } else if (state.crashEffect) {
      drawCrashEffect();
    } else {
      drawPlayer();
    }
  }

  function drawScenery(width, height) {
    const grass = context.createLinearGradient(0, 0, width, height);
    grass.addColorStop(0, '#3b633d');
    grass.addColorStop(.5, '#29472f');
    grass.addColorStop(1, '#42673d');
    context.fillStyle = grass;
    context.fillRect(0, 0, width, height);
    const stripeHeight = 92 * state.scale;
    const offset = state.roadOffset % stripeHeight;
    for (let y = -stripeHeight + offset; y < height + stripeHeight; y += stripeHeight) {
      context.fillStyle = 'rgba(206,230,145,.035)';
      context.fillRect(0, y, state.roadLeft - 8 * state.scale, 35 * state.scale);
      context.fillRect(state.roadLeft + state.roadWidth + 8 * state.scale, y, width, 35 * state.scale);
      drawRoadsideMarker(state.roadLeft - 16, y + 22, 1);
      drawRoadsideMarker(state.roadLeft + state.roadWidth + 16, y + 22, -1);
    }
  }

  function drawRoadsideMarker(x, y, direction) {
    context.save();
    context.translate(x, y);
    context.fillStyle = 'rgba(230,239,205,.68)';
    context.fillRect(-3 * state.scale, -9 * state.scale, 6 * state.scale, 18 * state.scale);
    context.fillStyle = '#ee7048';
    context.fillRect(-3 * state.scale, -9 * state.scale, 6 * state.scale, 7 * state.scale);
    context.restore();
  }

  function drawRoad(width, height) {
    const roadGradient = context.createLinearGradient(state.roadLeft, 0, state.roadLeft + state.roadWidth, 0);
    roadGradient.addColorStop(0, '#33393a');
    roadGradient.addColorStop(.5, '#424849');
    roadGradient.addColorStop(1, '#303638');
    context.fillStyle = roadGradient;
    context.fillRect(state.roadLeft, 0, state.roadWidth, height);
    context.fillStyle = '#d6d6bd';
    context.fillRect(state.roadLeft + 2 * state.scale, 0, 3 * state.scale, height);
    context.fillRect(state.roadLeft + state.roadWidth - 5 * state.scale, 0, 3 * state.scale, height);
    context.fillStyle = '#d95a48';
    const curbSize = 15 * state.scale;
    const curbOffset = state.roadOffset % curbSize;
    for (let y = -curbSize + curbOffset; y < height; y += curbSize) {
      context.fillRect(state.roadLeft + 5 * state.scale, y, 4 * state.scale, 8 * state.scale);
      context.fillRect(state.roadLeft + state.roadWidth - 9 * state.scale, y, 4 * state.scale, 8 * state.scale);
    }
    const dashHeight = 37 * state.scale;
    const dashGap = 31 * state.scale;
    const dashOffset = state.roadOffset % (dashHeight + dashGap);
    context.fillStyle = 'rgba(237,239,223,.83)';
    for (let lane = 1; lane < 3; lane++) {
      const x = state.roadLeft + state.laneWidth * lane - 1.5 * state.scale;
      for (let y = -dashHeight + dashOffset; y < height; y += dashHeight + dashGap) {
        context.fillRect(x, y, 3 * state.scale, dashHeight);
      }
    }
    context.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = (state.roadOffset * .45) % (54 * state.scale); y < height; y += 54 * state.scale) {
      context.fillRect(state.roadLeft + 17 * state.scale, y, state.roadWidth - 34 * state.scale, state.scale);
    }
  }

  function drawCarShape(x, y, width, height, color, isPlayer = false) {
    const left = x - width / 2;
    context.save();
    context.shadowColor = 'rgba(0,0,0,.42)';
    context.shadowBlur = 9;
    context.shadowOffsetY = 4;
    roundedRect(left, y, width, height, width * .19, color);
    context.shadowColor = 'transparent';
    context.fillStyle = '#171c1d';
    roundedRect(left - width * .055, y + height * .19, width * .12, height * .24, 3, '#171c1d');
    roundedRect(left + width * .935, y + height * .19, width * .12, height * .24, 3, '#171c1d');
    roundedRect(left - width * .055, y + height * .66, width * .12, height * .2, 3, '#171c1d');
    roundedRect(left + width * .935, y + height * .66, width * .12, height * .2, 3, '#171c1d');
    const glass = isPlayer ? '#203c42' : '#27383b';
    roundedRect(left + width * .2, y + height * .18, width * .6, height * .24, width * .08, glass);
    roundedRect(left + width * .23, y + height * .53, width * .54, height * .19, width * .05, glass);
    context.fillStyle = 'rgba(255,255,255,.2)';
    context.fillRect(left + width * .15, y + height * .46, width * .7, Math.max(2, height * .025));
    context.fillStyle = isPlayer ? '#eaff9a' : '#fff0cf';
    context.fillRect(left + width * .17, y + height * .055, width * .2, height * .045);
    context.fillRect(left + width * .63, y + height * .055, width * .2, height * .045);
    context.fillStyle = isPlayer ? '#f45646' : '#d84d42';
    context.fillRect(left + width * .17, y + height * .91, width * .2, height * .045);
    context.fillRect(left + width * .63, y + height * .91, width * .2, height * .045);
    if (isPlayer) {
      context.fillStyle = 'rgba(228,255,170,.25)';
      context.fillRect(left + width * .43, y + height * .04, width * .14, height * .88);
    }
    context.restore();
  }

  function roundedRect(x, y, width, height, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  }

  function drawPlayer() {
    const carWidth = state.laneWidth * .53;
    const carHeight = carWidth * 1.63;
    const baseY = state.mode === 'gameover'
      ? state.height * .54
      : state.height - carHeight - state.height * .09;
    const jumpHeight = getJumpHeight(carHeight);
    if (jumpHeight > 0) {
      context.save();
      context.globalAlpha = .2;
      context.fillStyle = '#07100a';
      context.beginPath();
      context.ellipse(state.player.x, baseY + carHeight * .92, carWidth * .42, carHeight * .12, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    const carY = baseY - jumpHeight;
    drawCarShape(state.player.x, carY, carWidth, carHeight, '#e4eac6', true);
    drawPlayerDoors(state.player.x, carY, carWidth, carHeight);
  }

  function drawPlayerDoors(x, y, width, height) {
    if (state.player.jumpTime < 0) return;
    const opening = getDoorOpening() * .55;
    const doorWidth = width * .16;
    const doorLength = height * .27;
    for (const side of [-1, 1]) {
      context.save();
      context.translate(x + side * width * .43, y + height * .42);
      context.rotate(-side * opening);
      roundedRect(side < 0 ? -doorWidth : 0, 0, doorWidth, doorLength, width * .035, '#e4eac6');
      context.strokeStyle = 'rgba(35,48,37,.7)';
      context.lineWidth = Math.max(1, state.scale);
      context.strokeRect(side < 0 ? -doorWidth : 0, 0, doorWidth, doorLength);
      context.restore();
    }
  }

  function resetPedestrians() {
    state.pedestrians = [];
    spawnPedestrianGroup(true);
    state.pedestrianSpawnTimer = 8 + Math.random() * 4;
  }

  function spawnPedestrianGroup(initial = false) {
    const groupSize = 2 + Math.floor(Math.random() * 3);
    [-1, 1].forEach(side => {
      for (let index = 0; index < groupSize; index++) {
        state.pedestrians.push({
          side,
          sideOffset: Math.random(),
          y: -(initial ? 8 : 18) * state.scale - index * (15 + Math.random() * 8) * state.scale,
          phase: Math.random() * Math.PI * 2,
          jacket: ['#d6aa4c', '#6c9d8b', '#b96c52', '#7891ad', '#ded4b7'][Math.floor(Math.random() * 5)],
          trousers: ['#29343a', '#43434a', '#343b30', '#5a4740'][Math.floor(Math.random() * 4)],
          skin: ['#d9ad87', '#a97052', '#edc6a0', '#80563f'][Math.floor(Math.random() * 4)]
        });
      }
    });
  }

  function drawPedestrians() {
    const leftSpace = state.roadLeft;
    const rightSpace = state.width - state.roadLeft - state.roadWidth;
    state.pedestrians.forEach(person => {
      const sideSpace = person.side < 0 ? leftSpace : rightSpace;
      const margin = 14 * state.scale;
      const offsetRange = Math.max(0, sideSpace - margin * 2);
      const perspective = .45 + Math.max(0, Math.min(1, person.y / state.height)) * .65;
      const x = person.side < 0
        ? state.roadLeft - margin - person.sideOffset * offsetRange
        : state.roadLeft + state.roadWidth + margin + person.sideOffset * offsetRange;
      const stride = Math.sin(state.elapsed * 4 + person.phase) * 2.2 * perspective;
      const size = state.scale * perspective;
      context.save();
      context.translate(x, person.y);
      context.scale(size, size);
      context.fillStyle = 'rgba(5,12,8,.32)';
      context.beginPath();
      context.ellipse(0, 7.5, 5, 2.1, 0, 0, Math.PI * 2);
      context.fill();
      context.lineCap = 'round';
      context.lineWidth = 1.8;
      context.strokeStyle = person.trousers;
      context.beginPath();
      context.moveTo(-1.5, 3);
      context.lineTo(-2.3 + stride, 8);
      context.moveTo(1.5, 3);
      context.lineTo(2.3 - stride, 8);
      context.stroke();
      context.strokeStyle = person.jacket;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(-2.5, -1);
      context.lineTo(-4 - stride * .35, 2.5);
      context.moveTo(2.5, -1);
      context.lineTo(4 + stride * .35, 2.5);
      context.stroke();
      roundedRect(-3.1, -4, 6.2, 8, 2, person.jacket);
      context.fillStyle = person.skin;
      context.beginPath();
      context.arc(0, -6.2, 2.2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }

  function getJumpHeight(carHeight = state.laneWidth * .53 * 1.63) {
    if (state.player.jumpTime < 0) return 0;
    const time = state.player.jumpTime;
    if (time < jumpRiseDuration) {
      const progress = time / jumpRiseDuration;
      const eased = progress * progress * (3 - 2 * progress);
      return state.player.jumpPeakHeight * eased;
    }
    if (state.player.jumpFallTime < 0) return state.player.jumpPeakHeight;
    const progress = Math.min(1, state.player.jumpFallTime / jumpFallDuration);
    const eased = progress * progress * (3 - 2 * progress);
    return state.player.jumpPeakHeight * (1 - eased);
  }

  function getDoorOpening() {
    if (state.player.jumpTime < jumpRiseDuration) {
      const progress = state.player.jumpTime / jumpRiseDuration;
      return progress * progress * (3 - 2 * progress);
    }
    if (state.player.jumpFallTime < 0) return 1;
    const progress = Math.min(1, state.player.jumpFallTime / jumpFallDuration);
    return 1 - progress * progress * (3 - 2 * progress);
  }

  function jumpPlayer() {
    if (state.mode !== 'playing' || state.player.jumpTime >= 0) return;
    const playerHeight = state.laneWidth * .47 * 1.63;
    const playerTop = state.height - playerHeight - state.height * .09;
    const playerBottom = playerTop + playerHeight;
    const leadDistance = state.laneWidth * 1.5;
    state.player.jumpTarget = state.objects
      .filter(item => item.lane === state.player.lane && item.y < playerBottom &&
        item.y + (item.height || state.laneWidth * .7) > playerTop - leadDistance)
      .sort((first, second) => second.y - first.y)[0] || null;
    state.player.jumpTime = 0;
    state.player.jumpPeakHeight = state.laneWidth * .53 * 1.63 * .55;
    state.player.jumpFallTime = -1;
  }

  function drawCrashEffect() {
    const effect = state.crashEffect;
    if (!effect) return;
    effect.fragments.forEach(fragment => {
      context.save();
      context.globalAlpha = Math.max(0, 1 - effect.elapsed / .85);
      context.translate(fragment.x, fragment.y);
      context.rotate(fragment.rotation);
      context.fillStyle = fragment.color;
      context.fillRect(-fragment.width / 2, -fragment.height / 2, fragment.width, fragment.height);
      context.restore();
    });
  }

  function createCrashEffect(item) {
    const playerWidth = state.laneWidth * .53;
    const playerHeight = playerWidth * 1.63;
    const playerY = state.height - playerHeight - state.height * .09 - getJumpHeight(playerHeight);
    const trafficWidth = item.width || state.laneWidth * .52;
    const trafficHeight = item.height || trafficWidth * 1.62;
    const trafficX = laneCenter(item.lane) + (item.offsetX || 0);
    const trafficY = item.y;
    const fragments = [];
    const addCarFragments = (x, y, width, height, color) => {
      for (let index = 0; index < 9; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 55 + Math.random() * 190;
        fragments.push({
          x: x + (Math.random() - .5) * width * .65,
          y: y + Math.random() * height * .7,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 70,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - .5) * 9,
          width: width * (.12 + Math.random() * .24),
          height: height * (.08 + Math.random() * .18),
          color
        });
      }
    };
    addCarFragments(state.player.x, playerY, playerWidth, playerHeight, '#e4eac6');
    addCarFragments(trafficX, trafficY, trafficWidth, trafficHeight, item.color || '#ef554a');
    state.crashEffect = { elapsed: 0, fragments };
  }

  function animateCrash(timestamp) {
    const effect = state.crashEffect;
    if (!effect) return;
    const deltaSeconds = Math.min((timestamp - state.lastFrame) / 1000 || 0, .04);
    state.lastFrame = timestamp;
    effect.elapsed += deltaSeconds;
    effect.fragments.forEach(fragment => {
      fragment.x += fragment.vx * deltaSeconds;
      fragment.y += fragment.vy * deltaSeconds;
      fragment.vy += 330 * deltaSeconds;
      fragment.rotation += fragment.spin * deltaSeconds;
    });
    drawScene(deltaSeconds);
    if (effect.elapsed < .85) {
      state.animationId = requestAnimationFrame(animateCrash);
    } else {
      state.crashEffect = null;
      state.animationId = 0;
      drawScene(0);
      crashWarning.classList.remove('is-visible');
      crashWarning.setAttribute('aria-hidden', 'true');
      stage.classList.remove('crash-hit');
      showScreen('gameover');
    }
  }

  function drawTraffic(item) {
    const laneX = laneCenter(item.lane) + (item.offsetX || 0);
    if (item.type === 'cone') {
      const w = state.laneWidth * .31;
      const h = w * 1.28;
      context.save();
      context.shadowColor = 'rgba(0,0,0,.4)';
      context.shadowBlur = 5;
      context.beginPath();
      context.moveTo(laneX, item.y);
      context.lineTo(laneX + w / 2, item.y + h);
      context.lineTo(laneX - w / 2, item.y + h);
      context.closePath();
      context.fillStyle = '#f27643';
      context.fill();
      context.shadowColor = 'transparent';
      context.fillStyle = '#f6ecd4';
      context.fillRect(laneX - w * .32, item.y + h * .62, w * .64, h * .1);
      context.fillStyle = '#303738';
      context.fillRect(laneX - w * .66, item.y + h * .9, w * 1.32, h * .12);
      context.restore();
      item.width = w * 1.15;
      item.height = h;
    } else {
      const spec = trafficSpecs[item.type] || trafficSpecs.car;
      const w = state.laneWidth * spec.width;
      const h = w * spec.length;
      drawCarShape(laneX, item.y, w, h, item.color);
      if (spec.windows) {
        context.save();
        const windowWidth = w * .58;
        const windowHeight = h * .105;
        for (let index = 0; index < spec.windows; index++) {
          const windowY = item.y + h * (.29 + index * .125);
          roundedRect(laneX - windowWidth / 2, windowY, windowWidth, windowHeight, w * .035, '#27383b');
        }
        context.restore();
      }
      item.width = w * .96;
      item.height = h * .98;
    }
  }

  function chooseTrafficLane(availableLanes) {
    const variedLanes = availableLanes.filter(lane => lane !== state.lastSpawnLane);
    const choices = variedLanes.length ? variedLanes : availableLanes;
    const lane = choices[Math.floor(Math.random() * choices.length)];
    state.lastSpawnLane = lane;
    return lane;
  }

  function chooseTrafficType() {
    const recentTypes = state.recentTrafficTypes.slice(0, 2);
    const variedRoster = trafficRoster.filter(type => !recentTypes.includes(type));
    const roster = variedRoster.length ? variedRoster : trafficRoster;
    const type = roster[Math.floor(Math.random() * roster.length)];
    state.recentTrafficTypes.unshift(type);
    state.recentTrafficTypes.length = Math.min(2, state.recentTrafficTypes.length);
    return type;
  }

  function spawnTraffic() {
    const difficulty = state.difficulty;
    const roll = Math.random();
    const type = roll > .9 - difficulty * .16 ? 'cone' : chooseTrafficType();
    const lanes = [0, 1, 2];
    const availableLanes = lanes.filter(lane => !state.objects.some(item => item.lane === lane && item.y < state.height * .34));
    if (!availableLanes.length) return;
    const lane = chooseTrafficLane(availableLanes);
    const speedScale = type === 'cone' ? 1 : trafficSpecs[type].speed;
    state.objects.push({ lane, type, color: trafficColors[Math.floor(Math.random() * trafficColors.length)], y: -120, speedScale, passed: false });

    const pairChance = difficulty * .32;
    if (Math.random() < pairChance) {
      const otherLanes = lanes.filter(value => value !== lane && !state.objects.some(item => item.lane === value && item.y < state.height * .3));
      if (otherLanes.length) {
        const pairLane = chooseTrafficLane(otherLanes);
        const pairType = chooseTrafficType();
        state.objects.push({ lane: pairLane, type: pairType, color: trafficColors[Math.floor(Math.random() * trafficColors.length)], y: -150, speedScale: trafficSpecs[pairType].speed * .96, passed: false });
      }
    }
  }

  function changeLane(direction) {
    if (state.mode !== 'playing') return;
    state.player.lane = Math.max(0, Math.min(2, state.player.lane + direction));
    state.player.targetX = laneCenter(state.player.lane);
  }

  function checkCollisions() {
    const playerWidth = state.laneWidth * .47;
    const playerHeight = playerWidth * 1.63;
    const playerY = state.height - playerHeight - state.height * .09;
    for (const item of state.objects) {
      const itemX = laneCenter(item.lane) + (item.offsetX || 0);
      const itemWidth = item.width || state.laneWidth * .45;
      const itemHeight = item.height || state.laneWidth * .7;
      const edgePadding = state.laneWidth * .035;
      const overlapsX = Math.abs(state.player.x - itemX) < (playerWidth + itemWidth) / 2 - edgePadding;
      const overlapsY = playerY + playerHeight - edgePadding > item.y + edgePadding && playerY + edgePadding < item.y + itemHeight - edgePadding;
      if (state.player.jumpTime >= 0) continue;
      if (overlapsX && overlapsY) {
        createCrashEffect(item);
        endGame();
        return;
      }
    }
  }

  function update(deltaSeconds) {
    state.elapsed += deltaSeconds;
    const targetDifficulty = calculateDifficulty();
    state.difficulty += (targetDifficulty - state.difficulty) * Math.min(1, deltaSeconds * 1.35);
    audioManager.updateSpeed(state.difficulty);
    const roadSpeed = 180 + state.difficulty * 125;
    const trafficSpeed = 88 + state.difficulty * 92;
    state.roadOffset = (state.roadOffset + roadSpeed * deltaSeconds) % 10000;
    state.pedestrianSpawnTimer -= deltaSeconds;
    if (state.pedestrianSpawnTimer <= 0) {
      spawnPedestrianGroup();
      state.pedestrianSpawnTimer = 8 + Math.random() * 4;
    }
    state.pedestrians.forEach(person => {
      person.y += roadSpeed * .68 * deltaSeconds;
    });
    state.pedestrians = state.pedestrians.filter(person => person.y < state.height + 22 * state.scale);
    state.player.x += (state.player.targetX - state.player.x) * Math.min(1, deltaSeconds * 11);
    if (state.player.jumpTime >= 0) {
      state.player.jumpTime += deltaSeconds;
      const playerBottom = state.height - state.height * .09;
      const targetCleared = !state.player.jumpTarget || state.player.jumpTarget.y >= playerBottom;
      if (state.player.jumpFallTime < 0 && state.player.jumpTime >= jumpRiseDuration + jumpHoldDuration && targetCleared) {
        state.player.jumpFallTime = 0;
      } else if (state.player.jumpFallTime >= 0) {
        state.player.jumpFallTime += deltaSeconds;
      }
      if (state.player.jumpFallTime >= jumpFallDuration) {
        state.player.jumpTime = -1;
        state.player.jumpPeakHeight = 0;
        state.player.jumpFallTime = -1;
        state.player.jumpTarget = null;
      }
    }
    state.spawnTimer -= deltaSeconds;
    const spawnInterval = 1.45 - state.difficulty * .72;
    if (state.spawnTimer <= 0) {
      spawnTraffic();
      state.spawnTimer = spawnInterval * (.82 + Math.random() * .36);
    }
    state.objects.forEach(item => {
      item.y += (roadSpeed + trafficSpeed * (item.speedScale || 1)) * deltaSeconds;
      if (!item.passed && item.y > state.height - state.height * .09) {
        item.passed = true;
        if (item.type !== 'cone') addScore(100);
      }
    });
    state.objects = state.objects.filter(item => item.y < state.height + 150);
    addScore(deltaSeconds * (10 + state.difficulty * 10));
    checkCollisions();
    if (state.mode !== 'playing') return;
    updateHud();
  }

  function frame(timestamp) {
    if (state.mode !== 'playing') return;
    const deltaSeconds = Math.min((timestamp - state.lastFrame) / 1000 || 0, .04);
    state.lastFrame = timestamp;
    update(deltaSeconds);
    drawScene(deltaSeconds);
    if (state.mode === 'playing') state.animationId = requestAnimationFrame(frame);
  }

  function startLoop() {
    cancelAnimationFrame(state.animationId);
    state.lastFrame = performance.now();
    state.animationId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }

  function startGame() {
    audioManager.resetForGame();
    state.mode = 'playing';
    state.score = 0;
    state.elapsed = 0;
    state.difficulty = 0;
    state.spawnTimer = .6;
    state.lastSpawnLane = null;
    state.recentTrafficTypes = [];
    state.roadOffset = 0;
    state.objects = [];
    resetPedestrians();
    state.crashEffect = null;
    state.player.lane = 1;
    state.player.x = laneCenter(1);
    state.player.targetX = state.player.x;
    state.player.jumpTime = -1;
    state.player.jumpPeakHeight = 0;
    state.player.jumpFallTime = -1;
    state.player.jumpTarget = null;
    stage.classList.remove('crash-hit');
    crashWarning.classList.remove('is-visible');
    crashWarning.setAttribute('aria-hidden', 'true');
    hud.hidden = false;
    showScreen(null);
    updateHud();
    audioManager.startGameplay();
    startLoop();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    stopLoop();
    audioManager.pauseGameplay();
    showScreen('paused');
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    showScreen(null);
    audioManager.startGameplay();
    startLoop();
  }

  function endGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'gameover';
    stopLoop();
    audioManager.handleCollision();
    stage.classList.add('crash-hit');
    crashWarning.classList.add('is-visible');
    crashWarning.setAttribute('aria-hidden', 'false');
    state.highScore = Math.max(state.highScore, Math.floor(state.score));
    saveHighScore();
    hud.hidden = true;
    ui.finalScore.textContent = formatScore(state.score);
    ui.finalHighScore.textContent = formatScore(state.highScore);
    updateHud();
    showScreen(null);
    state.lastFrame = performance.now();
    state.animationId = requestAnimationFrame(animateCrash);
  }

  function addScore(amount) {
    state.score += amount;
    const wholeScore = Math.floor(state.score);
    if (wholeScore > state.highScore) {
      state.highScore = wholeScore;
      saveHighScore();
    }
  }

  function returnToMenu() {
    stopLoop();
    audioManager.stopGameplay();
    state.mode = 'menu';
    saveHighScore();
    hud.hidden = true;
    state.objects = [];
    state.crashEffect = null;
    state.player.lane = 1;
    state.player.x = laneCenter(1);
    state.player.targetX = state.player.x;
    state.player.jumpTime = -1;
    state.player.jumpPeakHeight = 0;
    state.player.jumpFallTime = -1;
    state.player.jumpTarget = null;
    stage.classList.remove('crash-hit');
    crashWarning.classList.remove('is-visible');
    crashWarning.setAttribute('aria-hidden', 'true');
    showScreen('menu');
    updateHud();
    drawScene(0);
  }

  const melody = [523.25, 659.25, 783.99, null, 659.25, 587.33, 523.25, null,
    659.25, 783.99, 880, 783.99, 659.25, null, 587.33, 659.25,
    523.25, null, 659.25, 783.99, 659.25, 587.33, 523.25, null,
    587.33, 659.25, 783.99, null, 659.25, 587.33, 523.25, null];
  const chordProgression = [
    [261.63, 329.63, 392],
    [293.66, 392, 493.88],
    [220, 261.63, 329.63],
    [261.63, 349.23, 440]
  ];

  const audioManager = {
    context: null,
    backgroundMusic: null,
    engineSound: null,
    gameOverSound: { source: null, gain: null, playing: false },
    buttonSound: { source: null, gain: null, playing: false },
    lastDifficulty: -1,

    initialize() {
      if (!state.soundEnabled) return null;
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        this.context = new AudioContextClass();
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      if (!this.backgroundMusic) {
        const gain = this.context.createGain();
        gain.gain.value = 0;
        gain.connect(this.context.destination);
        this.backgroundMusic = { gain, voices: new Set(), step: 0, nextNoteTime: 0, timer: 0, playing: false };
      }
      if (!this.engineSound) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 58;
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start();
        this.engineSound = { oscillator, gain, playing: false };
      }
      return this.context;
    },

    createMusicVoice(frequency, startTime, duration, volume, attack, release, waveform) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const voice = { oscillator, envelope };
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      envelope.gain.setValueAtTime(.0001, startTime);
      envelope.gain.linearRampToValueAtTime(volume, startTime + attack);
      envelope.gain.setTargetAtTime(.0001, startTime + duration, Math.max(.025, release / 3));
      oscillator.connect(envelope);
      envelope.connect(this.backgroundMusic.gain);
      oscillator.onended = () => this.backgroundMusic.voices.delete(voice);
      this.backgroundMusic.voices.add(voice);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + release);
    },

    scheduleMusic() {
      const music = this.backgroundMusic;
      const audio = this.context;
      if (!music || !music.playing || !state.soundEnabled || state.mode !== 'playing' || audio.state !== 'running') return;
      const beatLength = 60 / (92 + state.difficulty * 10) / 2;
      if (music.nextNoteTime < audio.currentTime - beatLength) music.nextNoteTime = audio.currentTime + .02;
      const scheduleUntil = audio.currentTime + .2;
      while (music.nextNoteTime < scheduleUntil) {
        const step = music.step;
        const note = melody[step];
        if (note) this.createMusicVoice(note, music.nextNoteTime, .23, .11, .035, .14, 'triangle');
        if (step % 8 === 0) {
          const chord = chordProgression[Math.floor(step / 8)];
          chord.forEach(frequency => this.createMusicVoice(frequency, music.nextNoteTime, 1.45, .022, .28, .32, 'sine'));
        }
        music.step = (step + 1) % melody.length;
        music.nextNoteTime += beatLength;
      }
    },

    startBackgroundMusic() {
      const audio = this.initialize();
      if (!audio || state.mode !== 'playing') return;
      const music = this.backgroundMusic;
      if (music.playing) return;
      music.playing = true;
      music.nextNoteTime = audio.currentTime + .05;
      music.gain.gain.cancelScheduledValues(audio.currentTime);
      music.gain.gain.setTargetAtTime(.2, audio.currentTime, .16);
      this.scheduleMusic();
      music.timer = window.setInterval(() => this.scheduleMusic(), 80);
    },

    pauseBackgroundMusic() {
      const music = this.backgroundMusic;
      if (!music || !music.playing) return;
      music.playing = false;
      window.clearInterval(music.timer);
      music.timer = 0;
      const now = this.context.currentTime;
      music.gain.gain.cancelScheduledValues(now);
      music.gain.gain.setTargetAtTime(0, now, .025);
      music.voices.forEach(({ oscillator, envelope }) => {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setTargetAtTime(.0001, now, .015);
        try { oscillator.stop(now + .08); } catch { /* Voice already stopped. */ }
      });
    },

    stopBackgroundMusic() {
      const music = this.backgroundMusic;
      if (!music) return;
      music.playing = false;
      window.clearInterval(music.timer);
      music.timer = 0;
      if (!this.context) return;
      const now = this.context.currentTime;
      music.gain.gain.cancelScheduledValues(now);
      music.gain.gain.setValueAtTime(0, now);
      music.voices.forEach(({ oscillator, envelope }) => {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setValueAtTime(0, now);
        try { oscillator.stop(now + .01); } catch { /* Voice already stopped. */ }
      });
    },

    startEngineSound() {
      const audio = this.initialize();
      const engine = this.engineSound;
      if (!audio || !engine || engine.playing) return;
      engine.playing = true;
      engine.oscillator.frequency.setTargetAtTime(58 + state.difficulty * 26, audio.currentTime, .18);
      engine.gain.gain.cancelScheduledValues(audio.currentTime);
      engine.gain.gain.setTargetAtTime(.018, audio.currentTime, .06);
    },

    stopEngineSound(immediate = false) {
      const engine = this.engineSound;
      if (!engine || !this.context) return;
      engine.playing = false;
      const now = this.context.currentTime;
      engine.gain.gain.cancelScheduledValues(now);
      if (immediate) engine.gain.gain.setValueAtTime(0, now);
      else engine.gain.gain.setTargetAtTime(0, now, .025);
    },

    updateSpeed(difficulty) {
      if (!this.engineSound?.playing || !this.context || Math.abs(difficulty - this.lastDifficulty) < .015) return;
      this.lastDifficulty = difficulty;
      this.engineSound.oscillator.frequency.setTargetAtTime(58 + difficulty * 26, this.context.currentTime, .2);
    },

    playOneShot(track, frequency, endFrequency, duration, volume, waveform) {
      const audio = this.initialize();
      if (!audio || !track) return;
      this.stopOneShot(track);
      const source = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      source.type = waveform;
      source.frequency.setValueAtTime(frequency, now);
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, now + duration * .8);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(gain);
      gain.connect(audio.destination);
      track.source = source;
      track.gain = gain;
      track.playing = true;
      source.onended = () => {
        if (track.source !== source) return;
        track.source = null;
        track.gain = null;
        track.playing = false;
      };
      source.start(now);
      source.stop(now + duration + .01);
    },

    stopOneShot(track) {
      if (!track?.source || !this.context) return;
      const source = track.source;
      const now = this.context.currentTime;
      if (track.gain) {
        track.gain.gain.cancelScheduledValues(now);
        track.gain.gain.setValueAtTime(0, now);
      }
      track.source = null;
      track.gain = null;
      track.playing = false;
      try { source.stop(now); } catch { /* Sound already ended. */ }
    },

    playButtonSound() {
      this.playOneShot(this.buttonSound, 720, 560, .065, .025, 'sine');
    },

    playGameOverSound() {
      this.playOneShot(this.gameOverSound, 330, 88, .48, .07, 'triangle');
    },

    startGameplay() {
      if (!state.soundEnabled) return;
      this.startEngineSound();
      this.startBackgroundMusic();
    },

    pauseGameplay() {
      this.pauseBackgroundMusic();
      this.stopEngineSound();
    },

    handleCollision() {
      this.stopBackgroundMusic();
      this.stopEngineSound(true);
      this.stopOneShot(this.buttonSound);
      this.stopOneShot(this.gameOverSound);
      this.playGameOverSound();
    },

    stopGameplay() {
      this.stopBackgroundMusic();
      this.stopEngineSound(true);
      this.stopOneShot(this.buttonSound);
      this.stopOneShot(this.gameOverSound);
    },

    resetForGame() {
      this.stopGameplay();
      if (this.backgroundMusic) this.backgroundMusic.step = 0;
      this.lastDifficulty = -1;
    },

    muteAll() {
      this.stopBackgroundMusic();
      this.stopEngineSound(true);
      this.stopOneShot(this.buttonSound);
      this.stopOneShot(this.gameOverSound);
    }
  };

  function updateSoundButtons() {
    const soundButton = document.querySelector('#sound-button');
    const menuButton = document.querySelector('#menu-sound-button');
    soundButton.classList.toggle('sound-muted', !state.soundEnabled);
    soundButton.setAttribute('aria-label', `Turn sound ${state.soundEnabled ? 'off' : 'on'}`);
    soundButton.title = `Sound ${state.soundEnabled ? 'on' : 'off'}`;
    menuButton.setAttribute('aria-pressed', String(state.soundEnabled));
    menuButton.textContent = `SOUND: ${state.soundEnabled ? 'ON' : 'OFF'}`;
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    saveSoundPreference();
    updateSoundButtons();
    if (!state.soundEnabled) audioManager.muteAll();
    else if (state.mode === 'playing') audioManager.startGameplay();
    else audioManager.playButtonSound();
  }

  document.querySelector('#play-button').addEventListener('click', startGame);
  document.querySelector('#how-button').addEventListener('click', () => { audioManager.playButtonSound(); showScreen('how'); });
  document.querySelector('#how-back-button').addEventListener('click', () => { audioManager.playButtonSound(); showScreen('menu'); });
  document.querySelector('#pause-button').addEventListener('click', pauseGame);
  document.querySelector('#resume-button').addEventListener('click', resumeGame);
  document.querySelector('#pause-restart-button').addEventListener('click', startGame);
  document.querySelector('#pause-menu-button').addEventListener('click', returnToMenu);
  document.querySelector('#restart-button').addEventListener('click', startGame);
  document.querySelector('#gameover-menu-button').addEventListener('click', returnToMenu);
  document.querySelector('#sound-button').addEventListener('click', toggleSound);
  document.querySelector('#menu-sound-button').addEventListener('click', toggleSound);
  document.querySelector('#brand-home').addEventListener('click', event => { event.preventDefault(); returnToMenu(); });
  canvas.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing') return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * state.width / bounds.width;
    const y = (event.clientY - bounds.top) * state.height / bounds.height;
    state.gestureStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const start = state.gestureStart;
    if (!start || start.pointerId !== event.pointerId || start.handled || state.mode !== 'playing') return;
    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    const swipeThreshold = Math.max(28, state.height * .045);
    if (deltaY <= -swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
      jumpPlayer();
      start.handled = true;
    } else if (Math.abs(deltaX) >= swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      changeLane(Math.sign(deltaX));
      start.handled = true;
    }
  });
  canvas.addEventListener('pointerup', event => {
    const start = state.gestureStart;
    state.gestureStart = null;
    if (!start || start.pointerId !== event.pointerId || start.handled || state.mode !== 'playing') return;
    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    const swipeThreshold = Math.max(28, state.height * .045);
    if (deltaY <= -swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
      jumpPlayer();
      return;
    }
    if (Math.abs(deltaX) >= swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      changeLane(Math.sign(deltaX));
      return;
    }
    if (Math.abs(deltaX) < swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
      const carWidth = state.laneWidth * .53;
      const carHeight = carWidth * 1.63;
      const carY = state.height - carHeight - state.height * .09 - getJumpHeight(carHeight);
      const onPlayer = Math.abs(start.x - state.player.x) <= carWidth * .65 && start.y >= carY && start.y <= carY + carHeight;
      if (onPlayer) jumpPlayer();
      else changeLane(start.x < state.width / 2 ? -1 : 1);
    }
  });
  canvas.addEventListener('pointercancel', event => {
    if (state.gestureStart?.pointerId === event.pointerId) state.gestureStart = null;
  });

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') changeLane(-1);
    if (key === 'arrowright' || key === 'd') changeLane(1);
    if (key === ' ') jumpPlayer();
    if (key === 'escape' || key === 'p') {
      if (state.mode === 'playing') pauseGame();
      else if (state.mode === 'paused') resumeGame();
    }
  });

  new ResizeObserver(resizeCanvas).observe(stage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });

  showScreen('menu');
  updateHud();
  updateSoundButtons();
  resizeCanvas();
})();
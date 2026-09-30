(() => {
  'use strict';

  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  const stage = document.querySelector('.game-stage');
  const hud = document.querySelector('#game-hud');
  const touchControls = document.querySelector('#touch-controls');
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
  const state = {
    mode: 'menu',
    score: 0,
    highScore: loadHighScore(),
    elapsed: 0,
    difficulty: 0,
    roadOffset: 0,
    spawnTimer: 0,
    lastSpawnLane: null,
    lastFrame: 0,
    animationId: 0,
    objects: [],
    player: { lane: 1, x: 0, targetX: 0 },
    width: 0,
    height: 0,
    laneWidth: 0,
    scale: 1,
    roadLeft: 0,
    roadWidth: 0,
    soundEnabled: loadSoundPreference(),
    audio: null,
    music: null
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
    const timeProgress = Math.min(1, state.elapsed / 240);
    const scoreProgress = Math.min(1, state.score / 6000);
    return Math.min(1, timeProgress * .82 + scoreProgress * .18);
  }

  function updateHud() {
    ui.score.textContent = formatScore(state.score);
    ui.highScore.textContent = formatScore(state.highScore);
    ui.menuHighScore.textContent = formatScore(state.highScore);
    ui.speed.textContent = String(Math.round(84 + state.difficulty * 116)).padStart(3, '0');
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
    if (state.mode !== 'gameover') state.objects.forEach(drawTraffic);
    drawPlayer();
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
    const y = state.mode === 'gameover'
      ? state.height * .54
      : state.height - carHeight - state.height * .09;
    drawCarShape(state.player.x, y, carWidth, carHeight, '#e4eac6', true);
  }

  function drawTraffic(item) {
    const laneX = laneCenter(item.lane) + (item.offsetX || 0);
    if (item.type === 'truck') {
      const w = state.laneWidth * .78;
      const h = w * 1.85;
      context.save();
      context.shadowColor = 'rgba(0,0,0,.42)';
      context.shadowBlur = 8;
      context.shadowOffsetY = 4;
      roundedRect(laneX - w / 2, item.y, w, h, w * .1, item.color);
      context.shadowColor = 'transparent';
      roundedRect(laneX - w * .34, item.y + h * .06, w * .68, h * .2, 5, '#23383a');
      context.fillStyle = '#f8dfa0';
      context.fillRect(laneX - w * .34, item.y + h * .9, w * .16, h * .035);
      context.fillRect(laneX + w * .18, item.y + h * .9, w * .16, h * .035);
      context.fillStyle = 'rgba(20,25,24,.7)';
      context.fillRect(laneX - w * .54, item.y + h * .23, w * .13, h * .17);
      context.fillRect(laneX + w * .41, item.y + h * .23, w * .13, h * .17);
      context.restore();
      item.width = w;
      item.height = h;
    } else if (item.type === 'cone') {
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
      const w = state.laneWidth * .52;
      const h = w * 1.62;
      drawCarShape(laneX, item.y, w, h, item.color);
      item.width = w * .9;
      item.height = h * .9;
    }
  }

  function chooseTrafficLane(availableLanes) {
    const variedLanes = availableLanes.filter(lane => lane !== state.lastSpawnLane);
    const choices = variedLanes.length ? variedLanes : availableLanes;
    const lane = choices[Math.floor(Math.random() * choices.length)];
    state.lastSpawnLane = lane;
    return lane;
  }

  function spawnTraffic() {
    const difficulty = state.difficulty;
    const roll = Math.random();
    let type = 'car';
    if (roll > .9 - difficulty * .16) type = 'cone';
    else if (roll > .76) type = 'truck';
    const lanes = [0, 1, 2];
    const availableLanes = lanes.filter(lane => !state.objects.some(item => item.lane === lane && item.y < state.height * .34));
    if (!availableLanes.length) return;
    const lane = chooseTrafficLane(availableLanes);
    const speed = (88 + difficulty * 92) * (type === 'truck' ? .9 : 1);
    state.objects.push({ lane, type, color: trafficColors[Math.floor(Math.random() * trafficColors.length)], y: -120, speed, passed: false });

    const pairChance = difficulty * .32;
    if (Math.random() < pairChance) {
      const otherLanes = lanes.filter(value => value !== lane && !state.objects.some(item => item.lane === value && item.y < state.height * .3));
      if (otherLanes.length) {
        const pairLane = chooseTrafficLane(otherLanes);
        state.objects.push({ lane: pairLane, type: Math.random() > .25 ? 'car' : 'truck', color: trafficColors[Math.floor(Math.random() * trafficColors.length)], y: -150, speed: speed * .96, passed: false });
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
      if (overlapsX && overlapsY) {
        endGame();
        return;
      }
    }
  }

  function update(deltaSeconds) {
    state.elapsed += deltaSeconds;
    state.difficulty = calculateDifficulty();
    const roadSpeed = 180 + state.difficulty * 125;
    state.roadOffset = (state.roadOffset + roadSpeed * deltaSeconds) % 10000;
    state.player.x += (state.player.targetX - state.player.x) * Math.min(1, deltaSeconds * 11);
    state.spawnTimer -= deltaSeconds;
    const spawnInterval = 1.45 - state.difficulty * .72;
    if (state.spawnTimer <= 0) {
      spawnTraffic();
      state.spawnTimer = spawnInterval * (.82 + Math.random() * .36);
    }
    state.objects.forEach(item => {
      item.y += (roadSpeed + item.speed) * deltaSeconds;
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
    state.mode = 'playing';
    state.score = 0;
    state.elapsed = 0;
    state.difficulty = 0;
    state.spawnTimer = .6;
    state.lastSpawnLane = null;
    state.roadOffset = 0;
    state.objects = [];
    state.player.lane = 1;
    state.player.x = laneCenter(1);
    state.player.targetX = state.player.x;
    stage.classList.remove('crash-hit');
    hud.hidden = false;
    touchControls.hidden = false;
    showScreen(null);
    updateHud();
    startEngineSound();
    startMusic();
    startLoop();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    stopLoop();
    stopEngineSound();
    fadeMusic(.35);
    showScreen('paused');
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    showScreen(null);
    startEngineSound();
    startMusic();
    startLoop();
  }

  function endGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'gameover';
    stopLoop();
    stopEngineSound();
    fadeMusic(.75);
    stage.classList.add('crash-hit');
    playTone(90, .42, 'sawtooth');
    state.highScore = Math.max(state.highScore, Math.floor(state.score));
    saveHighScore();
    hud.hidden = true;
    touchControls.hidden = true;
    ui.finalScore.textContent = formatScore(state.score);
    ui.finalHighScore.textContent = formatScore(state.highScore);
    updateHud();
    showScreen('gameover');
    drawScene(0);
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
    stopEngineSound();
    fadeMusic(.35);
    state.mode = 'menu';
    saveHighScore();
    hud.hidden = true;
    touchControls.hidden = true;
    state.objects = [];
    state.player.lane = 1;
    state.player.x = laneCenter(1);
    state.player.targetX = state.player.x;
    showScreen('menu');
    updateHud();
    drawScene(0);
  }

  function initAudio() {
    if (!state.soundEnabled) return null;
    if (!state.audio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      state.audio = new AudioContextClass();
    }
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
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

  function createMusicVoice(frequency, startTime, duration, volume, attack, release, waveform) {
    const audio = state.audio;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const voice = { oscillator, envelope };
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    envelope.gain.setValueAtTime(.0001, startTime);
    envelope.gain.linearRampToValueAtTime(volume, startTime + attack);
    envelope.gain.setTargetAtTime(.0001, startTime + duration, Math.max(.025, release / 3));
    oscillator.connect(envelope);
    envelope.connect(state.music.gain);
    oscillator.onended = () => state.music.voices.delete(voice);
    state.music.voices.add(voice);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + release);
  }

  function scheduleMusic() {
    const music = state.music;
    const audio = state.audio;
    if (!music || !music.playing || !state.soundEnabled || state.mode !== 'playing' || audio.state !== 'running') return;
    const scheduleUntil = audio.currentTime + .2;
    while (music.nextNoteTime < scheduleUntil) {
      const step = music.step;
      const note = melody[step];
      if (note) createMusicVoice(note, music.nextNoteTime, .23, .11, .035, .14, 'triangle');
      if (step % 8 === 0) {
        const chord = chordProgression[Math.floor(step / 8)];
        chord.forEach(frequency => createMusicVoice(frequency, music.nextNoteTime, 1.45, .022, .28, .32, 'sine'));
      }
      music.step = (step + 1) % melody.length;
      music.nextNoteTime += 60 / (92 + state.difficulty * 10) / 2;
    }
  }

  function startMusic() {
    if (!state.soundEnabled) return;
    const audio = initAudio();
    if (!audio) return;
    if (!state.music) {
      const gain = audio.createGain();
      gain.gain.value = .0001;
      gain.connect(audio.destination);
      state.music = { gain, voices: new Set(), step: 0, nextNoteTime: 0, timer: 0, playing: false };
    }
    const music = state.music;
    if (music.playing) return;
    music.playing = true;
    music.nextNoteTime = audio.currentTime + .05;
    music.gain.gain.cancelScheduledValues(audio.currentTime);
    music.gain.gain.setTargetAtTime(.2, audio.currentTime, .16);
    scheduleMusic();
    music.timer = window.setInterval(scheduleMusic, 80);
  }

  function fadeMusic(duration) {
    const music = state.music;
    if (!music || !music.playing) return;
    music.playing = false;
    window.clearInterval(music.timer);
    music.timer = 0;
    const now = state.audio.currentTime;
    music.gain.gain.cancelScheduledValues(now);
    music.gain.gain.setTargetAtTime(.0001, now, duration / 3);
    music.voices.forEach(({ oscillator, envelope }) => {
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setTargetAtTime(.0001, now, .035);
      try { oscillator.stop(now + duration); } catch { /* Voice already stopped. */ }
    });
  }

  function playTone(frequency, duration, type = 'sine') {
    if (!state.soundEnabled) return;
    const audio = initAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.07, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function startEngineSound() {
    if (!state.soundEnabled || state.engineOscillator) return;
    const audio = initAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 48 + state.difficulty * 30;
    gain.gain.value = .018;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    state.engineOscillator = oscillator;
    state.engineGain = gain;
  }

  function stopEngineSound() {
    if (!state.engineOscillator) return;
    try { state.engineOscillator.stop(); } catch { /* Already stopped. */ }
    state.engineOscillator = null;
    state.engineGain = null;
  }

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
    playTone(520, .07);
    if (state.soundEnabled && state.mode === 'playing') {
      startEngineSound();
      startMusic();
    } else {
      stopEngineSound();
      fadeMusic(.35);
    }
  }

  document.querySelector('#play-button').addEventListener('click', () => { playTone(520, .08); startGame(); });
  document.querySelector('#how-button').addEventListener('click', () => { playTone(390, .06); showScreen('how'); });
  document.querySelector('#how-back-button').addEventListener('click', () => showScreen('menu'));
  document.querySelector('#pause-button').addEventListener('click', pauseGame);
  document.querySelector('#resume-button').addEventListener('click', resumeGame);
  document.querySelector('#pause-restart-button').addEventListener('click', startGame);
  document.querySelector('#pause-menu-button').addEventListener('click', returnToMenu);
  document.querySelector('#restart-button').addEventListener('click', startGame);
  document.querySelector('#gameover-menu-button').addEventListener('click', returnToMenu);
  document.querySelector('#sound-button').addEventListener('click', toggleSound);
  document.querySelector('#menu-sound-button').addEventListener('click', toggleSound);
  document.querySelector('#brand-home').addEventListener('click', event => { event.preventDefault(); returnToMenu(); });
  document.querySelector('#left-button').addEventListener('pointerdown', event => { event.preventDefault(); changeLane(-1); });
  document.querySelector('#right-button').addEventListener('pointerdown', event => { event.preventDefault(); changeLane(1); });

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') changeLane(-1);
    if (key === 'arrowright' || key === 'd') changeLane(1);
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
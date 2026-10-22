'use strict';

const SLUG = "souls-bumper";
const STEP_MS = 20; // Movement was tuned for 50 logic steps a second.
const ESC = 27;
const COL1 = "990099";

let ctx = null;
let gameStarted = false;
let TIME = 0;
let RELOAD = false;
let musicOff = false;
let isPaused = false;
let menuBlocks = [];
let atlas = new Image();
atlas.src = "assets/atlas.png";
let cart = new Cart();

// Letterbox: the 800x600 world is scaled uniformly and centred in the free space.
const view = { scale: 1, x: 0, y: 0, dpr: 1 };

// Progress and per-level stats.
let store = null;
let controls = null;
let progress = { unlocked: 0, levels: {} };
let selected = 0;
let levelTime = 0;
let deathsAtStart = 0;
let runTime = 0;
let runFromStart = false;
let banner = null;

const lastLevel = () => LEVELS.length - 1; // The "thank you" room.

// Load the music player
genAudio();

// Called by body onload on index page
function startGame() {
  mg.start();
}

let mg = {
  canvas: document.createElement("canvas"),
  keys: [],
  start: function() {
    store = GameKit.createStore(SLUG);
    progress = store.get("progress", progress);
    musicOff = store.get("musicOff", false);
    selected = Math.min(progress.unlocked, lastLevel() - 1);
    GameKit.initShell({ slug: SLUG });
    controls = GameKit.createTouchControls({
      dpad: { left: "ArrowLeft", right: "ArrowRight" },
      buttons: [
        { label: "Jump", key: " " },
        { label: "Soul", key: "e" },
        { label: "Reset", key: "r", small: true },
        { label: "Pause", key: "Escape", small: true },
      ],
    });
    controls.hide();

    this.context = this.canvas.getContext("2d");
    ctx = this.context;
    this.canvas.classList.add("screen");
    document.body.prepend(this.canvas);
    this.resize();
    window.addEventListener("resize", () => this.resize());

    showIntro();
    buildLevelSelect();

    this.loop = GameKit.createLoop({ update: updateGameArea, stepsPerSecond: 1000 / STEP_MS });
    this.loop.start();

    // Keyboard
    window.addEventListener("keydown", function(e) {
      if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) e.preventDefault();
      if (e.keyCode == ESC) {
        if (gameStarted) setPaused(!isPaused);
        return;
      }
      mg.keys[e.keyCode] = true;
      if (!gameStarted) introKey(e);
    });
    window.addEventListener("keyup", function(e) {
      mg.keys[e.keyCode] = false;
      if (e.keyCode == R && gameStarted && !isPaused) RELOAD = true;
      if (e.keyCode == M) toggleMusic();
      if (e.keyCode == T) cart.tips = !cart.tips;
    });
    window.addEventListener("blur", () => { mg.keys = []; });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && gameStarted) setPaused(true);
      syncMusic();
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!gameStarted && e.pointerType != "mouse") startLevel(selected);
    });
    // Disable right click context menu
    this.canvas.oncontextmenu = function(e) {
      e.preventDefault();
    };
  },
  resize: function() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    // Keep the play area clear of the shell bar and, while playing on a touch
    // screen, of the on-screen controls (below in portrait, beside in landscape).
    const touch = gameStarted && !controls.el.hidden;
    const portrait = h >= w;
    const top = 52;
    const bottom = touch && portrait ? 210 : 8;
    const side = touch && !portrait ? 200 : 8;
    const availW = w - side * 2;
    const availH = h - top - bottom;
    view.scale = Math.min(availW / WORLD_W, availH / WORLD_H);
    view.dpr = dpr;
    view.x = side + (availW - WORLD_W * view.scale) / 2;
    // On a portrait phone's menu the world sits at the top, leaving the bottom for the level list.
    view.y = portrait && w < 700 && !gameStarted ? top : top + (availH - WORLD_H * view.scale) / 2;
    ctx.imageSmoothingEnabled = false;
  },
  // Clear the whole screen and set the world transform, clipped to the 800x600 box.
  begin: function() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.x * view.dpr, view.y * view.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
  },
  end: function() {
    ctx.restore();
    ctx.globalAlpha = .6;
    ctx.strokeStyle = "#" + COL1;
    ctx.lineWidth = 2 / view.scale;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.globalAlpha = 1;
  }
};

// ---------- Intro and level select ----------

function showIntro() {
  gameStarted = false;
  setPaused(false);
  controls.hide();
  mg.resize();
  mg.canvas.style.cursor = "";
  cart.genLevel(0);
  cart.cam.x = 0;
  cart.cam.y = 0;
  menuBlocks = cart.levels[0].tiles.filter((t) => t.entity.type > 0);
  document.getElementById("ui-menu").classList.toggle("hidden", false);
  document.getElementById("intro").classList.toggle("hidden", false);
  renderLevelSelect();
  syncMusic();
}

function buildLevelSelect() {
  const grid = document.getElementById("level-grid");
  for (let i = 0; i < lastLevel(); i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i + 1);
    b.addEventListener("click", () => {
      if (i <= progress.unlocked) startLevel(i);
    });
    b.addEventListener("pointerenter", () => {
      if (i <= progress.unlocked) {
        selected = i;
        renderLevelSelect();
      }
    });
    grid.append(b);
  }
}

function renderLevelSelect() {
  const buttons = document.querySelectorAll("#level-grid button");
  buttons.forEach((b, i) => {
    const locked = i > progress.unlocked;
    b.disabled = locked;
    b.classList.toggle("selected", i == selected);
    b.classList.toggle("cleared", !!progress.levels[i]);
    b.setAttribute("aria-label", locked ? "Level " + (i + 1) + " (locked)" : "Level " + (i + 1) + ": " + LEVELS[i].name);
  });
  const best = progress.levels[selected];
  document.getElementById("level-info").textContent =
    "Level " + (selected + 1) + ": " + LEVELS[selected].name +
    (best ? "  ·  best " + formatTime(best.time) + ", " + best.deaths + (best.deaths == 1 ? " death" : " deaths") : "");
  const touch = !!controls && !controls.el.hidden;
  document.getElementById("intro-prompt").innerText = !songLoaded
    ? "LOADING SOULS..."
    : GameKit.isTouchFirst() || touch ? "TAP A LEVEL TO BEGIN" : "PRESS ANY KEY TO BEGIN";
}

function introKey(e) {
  if ([LEFT, A].includes(e.keyCode)) {
    selected = Math.max(0, selected - 1);
    renderLevelSelect();
  } else if ([RIGHT, D].includes(e.keyCode)) {
    selected = Math.min(progress.unlocked, lastLevel() - 1, selected + 1);
    renderLevelSelect();
  } else if (![M, T, R, 16, 17, 18, 91, 9].includes(e.keyCode)) {
    startLevel(selected);
  }
}

function startLevel(num) {
  if (audioCtx == null) audioCtx = new AudioContext();
  if (audioCtx.state == "suspended") audioCtx.resume();
  selected = num;
  runFromStart = num == 0;
  runTime = 0;
  banner = null;
  cart.genLevel(num);
  gameStarted = true;
  mg.keys = [];
  levelTime = 0;
  deathsAtStart = cart.hero.deaths;
  document.getElementById("ui-menu").classList.toggle("hidden", true);
  document.getElementById("intro").classList.toggle("hidden", true);
  if (GameKit.isTouchFirst()) controls.show();
  mg.resize();
  mg.canvas.style.cursor = "none";
  syncMusic();
}

// ---------- Progress ----------

function formatTime(sec) {
  return sec.toFixed(2) + "s";
}

// Called by the cart when the hero leaves a level through its portal.
function onLevelComplete(idx) {
  const deaths = cart.hero.deaths - deathsAtStart;
  const time = levelTime;
  const prev = progress.levels[idx];
  const n = idx + 1;
  const newBest = !prev || time < prev.time;
  progress.levels[idx] = {
    time: prev ? Math.min(prev.time, time) : time,
    deaths: prev ? Math.min(prev.deaths, deaths) : deaths,
  };
  progress.unlocked = Math.max(progress.unlocked, Math.min(n, lastLevel() - 1));
  store.set("progress", progress);
  GameKit.recordBest(SLUG, time, { lowerIsBetter: true, mode: "level-" + n + "-time", label: "Level " + n + ": " + formatTime(time) });
  GameKit.recordBest(SLUG, deaths, { lowerIsBetter: true, mode: "level-" + n + "-deaths", label: "Level " + n + ": " + deaths + " deaths" });

  let sub = formatTime(time) + "  ·  " + deaths + (deaths == 1 ? " death" : " deaths") + (newBest ? "  ·  NEW BEST" : "");
  if (n == lastLevel() && runFromStart) {
    const run = GameKit.recordBest(SLUG, runTime, { lowerIsBetter: true, mode: "full-run", label: "Full run: " + formatTime(runTime) });
    sub = "Full run " + formatTime(runTime) + (run.isNew ? "  ·  NEW BEST" : "");
  }
  banner = { text: "LEVEL " + n + " CLEARED", sub: sub, t: 2.5 };
  levelTime = 0;
  deathsAtStart = cart.hero.deaths;
  selected = Math.min(n, lastLevel() - 1);
}

// Called by the cart when the player resets the level with [R].
function onLevelRestart() {
  levelTime = 0;
  deathsAtStart = cart.hero.deaths;
}

// ---------- Pause and music ----------

function setPaused(value) {
  isPaused = value;
  document.getElementById("pause-menu").classList.toggle("hidden", !isPaused);
  if (isPaused) mg.keys = [];
  syncMusic();
}

function toggleMusic() {
  musicOff = !musicOff;
  if (store) store.set("musicOff", musicOff);
  syncMusic();
}

function syncMusic() {
  if (!audio) return;
  const play = gameStarted && !musicOff && !isPaused && !document.hidden;
  if (play && audio.paused) audio.play().catch(() => {});
  else if (!play && !audio.paused) audio.pause();
}

// ---------- Main step ----------

function updateGameArea() {
  if (isPaused) return;
  const delta = STEP_MS;
  TIME += delta;
  mg.begin();

  if (!gameStarted) {
    // intro Screen
    cart.update(delta, TIME, true);
    drawBox(ctx, 0.1, "#" + COL1, 0, 0, WORLD_W, WORLD_H);
    writeTxt(ctx, 1, "80px 'VT323'", "WHITE", "SOULS BUMPER", 400, 150, "center");

    // The hero bobs on the first platform.
    ctx.save();
    ctx.translate(100, 225);
    ctx.drawImage(atlas, 0, 0, 16, 16, 32, 8 + Math.sin(TIME / 300) * 3, 32, 32);
    ctx.restore();

    if (rndNo(1, 100) > 97) {
      cart.hero.bloodSplatter(false, rndNo(20, 700), rndNo(20, 500));
      let rt = menuBlocks[rndNo(0, menuBlocks.length - 1)];
      for (let i = 1; i < 5; i++) {
        cart.hero.particles.push(new particle(rndNo(1, 2), 0, rt.entity.x + 18 + rndNo(0, 20), 15 + rt.entity.y, 0, "bld", false));
      }
    }
    for (let i = 0; i <= cart.hero.particles.length - 1; i++) {
      cart.hero.particles[i].update(ctx, delta / 1000);
    }
    cart.hero.particles = cart.hero.particles.filter((p) => p.remove == false);
    if (TIME % 1000 < STEP_MS) renderLevelSelect();
  } else {
    const lvl = cart.hero.e.curLevel;
    const playing = lvl < lastLevel() && !cart.hero.done;
    if (playing) {
      levelTime += delta / 1e3;
      runTime += delta / 1e3;
    }
    cart.update(delta / 1e3, TIME);
    drawBox(ctx, 0.1, "#" + COL1, 0, 0, WORLD_W, WORLD_H);
    drawHud(lvl);
  }
  mg.end();
  // The song is rendered in the background; start it once it's ready.
  if (TIME % 1000 < STEP_MS) syncMusic();
}

function drawHud(lvl) {
  let font = "32px 'VT323'";
  const touch = !controls.el.hidden;
  if (!touch && lvl < lastLevel()) {
    writeTxt(ctx, 1, font, "WHITE", "[M] Music: " + (musicOff ? "off" : "on"), 790, 20, "right");
    writeTxt(ctx, 1, font, "WHITE", "[T] Tips: " + (cart.tips ? "on" : "off"), 790, 45, "right");
    writeTxt(ctx, 1, font, "WHITE", "[R] Reset Level", 790, 70, "right");
  }
  if (lvl < lastLevel()) {
    writeTxt(ctx, 1, font, "WHITE", "Level " + (lvl + 1) + ": " + LEVELS[lvl].name, 10, 20);
    writeTxt(ctx, 1, font, "WHITE", "Lives: " + cart.hero.hp + "   Time: " + levelTime.toFixed(1), 10, 45);
    writeTxt(ctx, 1, font, "RED", "Deaths: " + (cart.hero.deaths - deathsAtStart), 10, 70);
  }

  const tips = LEVELS[lvl].tips;
  if (cart.tips || lvl == lastLevel()) {
    const finale = lvl == lastLevel();
    tips.forEach((tip, i) => {
      const big = finale && i == 0;
      writeTxt(ctx, 1, big ? "80px 'VT323'" : font, "WHITE", tip, 400, finale ? 100 + i * 50 : 110 + i * 22, "center");
    });
  }

  if (banner) {
    banner.t -= STEP_MS / 1000;
    const a = Math.min(1, banner.t);
    drawBox(ctx, .55 * a, "#000", 0, 470, WORLD_W, 90);
    writeTxt(ctx, a, "56px 'VT323'", "#05f2db", banner.text, 400, 512, "center");
    writeTxt(ctx, a, font, "WHITE", banner.sub, 400, 545, "center");
    ctx.globalAlpha = 1;
    if (banner.t <= 0) banner = null;
  }
}

function drawBox(ctx, a, colour, x, y, w, h) {
  ctx.globalAlpha = a;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function writeTxt(ctx, a, font, colour, txt, x, y, align) {
  ctx.globalAlpha = a;
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textAlign = align || "left";
  ctx.fillText(txt, x, y);
}

// Initialize DOM listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("continue-btn").onclick = () => setPaused(false);
  document.getElementById("restart-btn").onclick = () => {
    RELOAD = true;
    setPaused(false);
  };
  document.getElementById("select-btn").onclick = () => showIntro();
});

function left() {
  return mg.keys[LEFT] || mg.keys[A];
}

function right() {
  return mg.keys[RIGHT] || mg.keys[D];
}

function up() {
  return mg.keys[UP] || mg.keys[W];
}

function space() {
  return mg.keys[SPACE];
}

function one() {
  return mg.keys[ONE] || mg.keys[E];
}

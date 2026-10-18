"use strict";
/* ============================================================
   Cha Chaan Teng Rush — Kitchen Arcade
   Top-down Overcooked-style canvas game
   ============================================================ */

// ---- Canvas ----
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const canvasWrap = document.getElementById("canvasWrap");
const app = document.getElementById("app");

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const scoreEl = $("scoreVal"), timeEl = $("timeVal"), highEl = $("highVal");
const startScreen = $("startScreen"), overScreen = $("overScreen");
const playBtn = $("playBtn"), replayBtn = $("replayBtn"), copyBtn = $("copyBtn");
const playTutBtn = $("playTutBtn");
const finalScoreEl = $("finalScore"), rankBadgeEl = $("rankBadge");
const overSubEl = $("overSub"), overHighEl = $("overHigh");
const interactBtn = $("interactBtn");
const tutorialModal = $("tutorialModal");
const howToPlayBtn = $("howToPlayBtn");
const tutStartBtn = $("tutStartBtn");
const tutCloseBtn = $("tutCloseBtn");
const muteBtn = $("muteBtn");
const phaseBadge = $("phaseBadge");
const phaseNum = $("phaseNum");
const phaseText = $("phaseText");
const tutPrompt = $("tutPrompt");
const tutStepNo = $("tutStepNo");
const tutStepText = $("tutStepText");
const tutDots = $("tutDots");
const tutExitBtn = $("tutExitBtn");

// ---- Layout constants (tile = 40px) ----
const TILE = 40;
const COLS = W / TILE; // 22
const ROWS = H / TILE; // 14

// ============================================================
// INGREDIENTS & DISHES
// ============================================================
const INGREDIENTS = {
  tea:     { emoji: "🫖", name: "Tea",          color: "#8b5a2b" },
  milk:    { emoji: "🥛", name: "Evap Milk",     color: "#f5f5f0" },
  bun:     { emoji: "🥯", name: "Bun",          color: "#d4a017" },
  butter:  { emoji: "🧈", name: "Butter",        color: "#ffd54a" },
  noodles: { emoji: "🍜", name: "Noodles",       color: "#e6a64f" },
  beef:    { emoji: "🥩", name: "Satay Beef",    color: "#9b3a3a" },
  egg:     { emoji: "🍳", name: "Egg",          color: "#ffd966" },
  toast:   { emoji: "🍞", name: "Toast",         color: "#d4a017" },
  peanut:  { emoji: "🥜", name: "Peanut Butter", color: "#c9963b" },
  syrup:   { emoji: "🍯", name: "Syrup",         color: "#ffb627" },
};
const ING_KEYS = Object.keys(INGREDIENTS);

const DISHES = [
  { key: "milktea",  emoji: "🧋", name: "Milk Tea",           recipe: ["tea","milk"] },
  { key: "boloyau",  emoji: "🍍", name: "Pineapple Bun",      recipe: ["bun","butter"] },
  { key: "satay",    emoji: "🍜", name: "Satay Beef Noodles", recipe: ["noodles","beef","egg"] },
  { key: "toast",    emoji: "🍞", name: "French Toast",       recipe: ["toast","peanut","syrup"] },
];

// ============================================================
// KITCHEN LAYOUT (grid-based) — COMPACT
// Ingredient stations pulled inward from the walls so the chef
// loops quickly between stations, assembly, and service.
// Delivery counter moved down so customer order bubbles render
// fully INSIDE the canvas (no top clipping).
// ============================================================

// Each station: { x, y, w, h (in tiles), type, key? (for ingredient), label }
const STATIONS = [];

// Helper to add a station
function addStation(x, y, w, h, type, extra={}) {
  STATIONS.push({ x, y, w, h, type, ...extra });
}

// --- Three side-by-side Delivery Counters (top area) ---
// Each is 3 tiles wide; placed at row 3 so customers stand at row 2
// (their bubbles draw above them, well inside the canvas top).
addStation(4,  3, 3, 1, "delivery", { slot: 0 });
addStation(9,  3, 3, 1, "delivery", { slot: 1 });
addStation(14, 3, 3, 1, "delivery", { slot: 2 });

// Customer stand positions — directly above each counter, row 2.
// Bubbles are drawn ~28px above the customer head, so the head at
// row 2 (~80px from top) keeps the bubble around y=52 — safely inside.
const CUSTOMER_SLOTS = [
  { x: 5.5,  y: 2.5 },
  { x: 10.5, y: 2.5 },
  { x: 15.5, y: 2.5 },
];

// --- Ingredient stations: pulled inward, two columns of five ---
// Left column at x=4, right column at x=17 (was 0 and 21).
// Stacked rows 5..13 (stepping by 2) → 5 stations each side.
const leftIng = ["tea","milk","bun","butter","noodles"];
const rightIng = ["beef","egg","toast","peanut","syrup"];
leftIng.forEach((k, i)  => addStation(4,  5 + i*2, 1, 1, "ingredient", { ingKey: k }));
rightIng.forEach((k, i) => addStation(17, 5 + i*2, 1, 1, "ingredient", { ingKey: k }));

// --- Central Assembly Table (4 wide × 2 tall) ---
addStation(9, 7, 4, 2, "assembly");

// --- Trash Can — directly adjacent to the Assembly Table (right side) ---
// Placed at (13, 7) so it's a single step from the assembly table —
// players can clear wrong ingredients/dishes without crossing the kitchen.
addStation(13, 7, 1, 1, "trash");

// Build collision map
const blocked = new Set();
function tileKey(x, y) { return x + "," + y; }
STATIONS.forEach(s => {
  for (let dx = 0; dx < s.w; dx++) {
    for (let dy = 0; dy < s.h; dy++) {
      blocked.add(tileKey(s.x + dx, s.y + dy));
    }
  }
});
// Outer walls (top + bottom rows) blocked for the player.
// Rows 1-2 are reserved for customer standing / bubbles, so block
// the very top row (row 0) only, plus the bottom row.
for (let x = 0; x < COLS; x++) {
  blocked.add(tileKey(x, 0));
  blocked.add(tileKey(x, ROWS-1));
}
// Also block row 2 where customers stand (so the chef can't walk into them)
// but only the tile under each customer slot.
CUSTOMER_SLOTS.forEach(s => {
  blocked.add(tileKey(Math.floor(s.x), Math.floor(s.y)));
});

function isBlocked(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return blocked.has(tileKey(x, y));
}

// ============================================================
// PLAYER
// ============================================================
const BASE_SPEED = 3.12;     // 2.4 * 1.30 = +30% walk speed
const SPRINT_MULT = 2.0;     // SHIFT doubles speed
const MAX_CARRY = 3;         // max ingredients the player can hold at once
const player = {
  x: 11 * TILE,   // pixel coords (center of player)
  y: 11 * TILE,
  w: 26, h: 30,
  facing: "down",   // up, down, left, right
  heldStack: [],    // array of items (ingKey string or { dish: key }); last = top
  moving: false,
  sprinting: false,
  stepPhase: 0,
  stepTimer: 0,
};

// ---- Stack helpers ----
function topHeld() {
  return player.heldStack.length > 0 ? player.heldStack[player.heldStack.length - 1] : null;
}
function isHoldingDish() {
  const t = topHeld();
  return t && typeof t === "object" && t.dish;
}
function isHoldingIngredient() {
  const t = topHeld();
  return t && typeof t === "string";
}
function clearHeldStack() {
  player.heldStack = [];
}

// ============================================================
// GAME STATE
// ============================================================
const G = {
  state: "menu",      // menu | play | tutorial | over
  mode: "none",       // "arcade" | "tutorial"
  time: 60,
  score: 0,
  high: 0,
  customers: [null, null, null],
  assemblyTray: [],
  lastTick: 0,
  spawnAcc: 0,
  spawnIntervalBase: 2800,
  keys: new Set(),
  touchDir: null,
  touchSprint: false,
  lastInteractTile: null,
  particles: [],
  phase: 1,            // 1, 2, 3
  // Phase config: patience seconds + max concurrent orders + spawn interval (ms)
  // Spawn intervals kept to 1–2s so empty counters refill quickly.
  // Patience stays generous (20–22s) per the spec.
  phaseCfg: {
    1: { patience: 22, maxOrders: 2, spawnInterval: 1600, label: "Relaxed" },
    2: { patience: 21, maxOrders: 3, spawnInterval: 1400, label: "Medium Rush" },
    3: { patience: 20, maxOrders: 3, spawnInterval: 1200, label: "Rush Hour!" },
  },
  // Tutorial state
  tutStep: 0,
  tutTargetDish: "milktea",
};

// Load high score
try { G.high = parseInt(localStorage.getItem("cct_high") || "0", 10) || 0; } catch(e) {}

// ============================================================
// WEB AUDIO — synthesized SFX
// ============================================================
let AC = null;
function audio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return null; }
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function tone(freq, dur, type="sine", vol=0.2, when=0, glideTo=null) {
  const ctx = audio(); if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function noiseBurst(dur, vol=0.15, when=0, filterFreq=800) {
  const ctx = audio(); if (!ctx) return;
  const t = ctx.currentTime + when;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur);
}
function sfxStep()    { tone(180 + Math.random()*30, 0.04, "square", 0.05); }
function sfxPickup()  { tone(660, 0.06, "triangle", 0.18); tone(880, 0.08, "triangle", 0.14, 0.05); }
function sfxDrop()    { tone(440, 0.05, "square", 0.15); }
function sfxSizzle()  { noiseBurst(0.25, 0.12, 0, 1200); tone(220, 0.18, "sawtooth", 0.1, 0.05); }
function sfxChop()    { tone(140, 0.04, "square", 0.18); tone(110, 0.06, "square", 0.15, 0.04); }
function sfxDing()     { tone(880, 0.08, "triangle", 0.22); tone(1320, 0.18, "sine", 0.18, 0.06); }
function sfxError()   { tone(180, 0.25, "sawtooth", 0.22, 0, 90); }
function sfxTick()     { tone(1500, 0.04, "square", 0.12); }
function sfxStart()    { tone(440, 0.08, "triangle", 0.2); tone(660, 0.08, "triangle", 0.2, 0.08); tone(880, 0.18, "triangle", 0.2, 0.16); }
function sfxGameOver() { tone(440, 0.18, "sawtooth", 0.2); tone(330, 0.18, "sawtooth", 0.2, 0.18); tone(220, 0.4, "sawtooth", 0.2, 0.36); }
function sfxSpawn()     { tone(660, 0.05, "sine", 0.1); }
function sfxTrash()    { noiseBurst(0.15, 0.12, 0, 600); tone(160, 0.15, "square", 0.15, 0.05); }

// ============================================================
// BACKGROUND MUSIC — 90s HK arcade synth-wave loop (Web Audio)
// A cheerful Canto-pop-inspired chiptune melody that loops continuously.
// All synthesized — no external audio files, zero copyright issues.
// ============================================================
const BGM = {
  ctx: null,
  master: null,
  playing: false,
  muted: false,
  step: 0,
  nextNoteTime: 0,
  timerId: null,
  // Tempo: 130 BPM, 16th notes → 0.115s per step
  tempo: 130,
  // Lead melody (Canto-pop-flavored phrase in C major / A minor)
  // Frequencies (Hz); 0 = rest
  lead: [
    523, 659, 784, 659, 523, 659, 784, 880,
    988, 784, 659, 523, 659, 784, 659, 523,
    440, 523, 659, 523, 440, 523, 659, 784,
    659, 523, 440, 392, 440, 523, 659, 523,
    523, 0, 659, 0, 784, 0, 880, 0,
    988, 880, 784, 659, 523, 659, 784, 880,
    659, 523, 440, 523, 659, 784, 659, 523,
    440, 523, 659, 523, 440, 392, 440, 0,
  ],
  // Bass line (root notes, lower octave)
  bass: [
    131, 0, 131, 0, 131, 0, 131, 0,
    196, 0, 196, 0, 196, 0, 196, 0,
    175, 0, 175, 0, 175, 0, 175, 0,
    147, 0, 147, 0, 147, 0, 147, 0,
    131, 0, 131, 0, 196, 0, 196, 0,
    196, 0, 196, 0, 131, 0, 131, 0,
    175, 0, 175, 0, 147, 0, 147, 0,
    110, 0, 110, 0, 110, 0, 110, 0,
  ],
};

function bgmEnsureCtx() {
  if (BGM.ctx) return;
  const ctx = audio();
  if (!ctx) return;
  BGM.ctx = ctx;
  BGM.master = ctx.createGain();
  BGM.master.gain.value = 0.18;  // background volume
  BGM.master.connect(ctx.destination);
}

function bgmScheduleNote(stepIdx, when) {
  const ctx = BGM.ctx; if (!ctx) return;
  const stepDur = 60.0 / BGM.tempo / 4; // 16th note duration

  // Lead
  const leadFreq = BGM.lead[stepIdx % BGM.lead.length];
  if (leadFreq > 0) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(leadFreq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.14, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + stepDur * 0.9);
    osc.connect(g); g.connect(BGM.master);
    osc.start(when); osc.stop(when + stepDur);
  }

  // Bass
  const bassFreq = BGM.bass[stepIdx % BGM.bass.length];
  if (bassFreq > 0) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(bassFreq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.18, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + stepDur * 1.4);
    osc.connect(g); g.connect(BGM.master);
    osc.start(when); osc.stop(when + stepDur * 1.5);
  }

  // Hi-hat (noise tick on off-beats for arcade feel)
  if (stepIdx % 2 === 1) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = "highpass"; filt.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(filt); filt.connect(g); g.connect(BGM.master);
    src.start(when); src.stop(when + 0.03);
  }
}

function bgmScheduler() {
  if (!BGM.playing || !BGM.ctx) return;
  const ctx = BGM.ctx;
  const stepDur = 60.0 / BGM.tempo / 4;
  // Schedule notes ahead by 0.2s
  while (BGM.nextNoteTime < ctx.currentTime + 0.2) {
    bgmScheduleNote(BGM.step, BGM.nextNoteTime);
    BGM.nextNoteTime += stepDur;
    BGM.step = (BGM.step + 1) % Math.max(BGM.lead.length, BGM.bass.length);
  }
  BGM.timerId = setTimeout(bgmScheduler, 25);
}

function bgmStart() {
  bgmEnsureCtx();
  if (!BGM.ctx || BGM.playing) return;
  if (BGM.muted) return; // don't start if muted
  BGM.playing = true;
  BGM.step = 0;
  BGM.nextNoteTime = BGM.ctx.currentTime + 0.05;
  bgmScheduler();
}

function bgmStop() {
  BGM.playing = false;
  if (BGM.timerId) { clearTimeout(BGM.timerId); BGM.timerId = null; }
}

function bgmToggleMute() {
  BGM.muted = !BGM.muted;
  if (BGM.muted) {
    bgmStop();
    if (BGM.master) BGM.master.gain.value = 0;
    muteBtn.textContent = "🔇 Muted";
    muteBtn.classList.add("muted");
  } else {
    if (BGM.master) BGM.master.gain.value = 0.18;
    muteBtn.textContent = "🔊 BGM";
    muteBtn.classList.remove("muted");
    // start BGM if a game is active or on title screen
    if (G.state !== "over") bgmStart();
  }
}

// ============================================================
// INPUT
// ============================================================
const KEY_MAP = {
  "ArrowUp": "up", "KeyW": "up",
  "ArrowDown": "down", "KeyS": "down",
  "ArrowLeft": "left", "KeyA": "left",
  "ArrowRight": "right", "KeyD": "right",
};
window.addEventListener("keydown", (e) => {
  if (KEY_MAP[e.code]) {
    G.keys.add(KEY_MAP[e.code]);
    e.preventDefault();
  }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    G.keys.add("sprint");
    e.preventDefault();
  }
  if (e.code === "Space" || e.code === "KeyE") {
    e.preventDefault();
    if (G.state === "play") interact();
    else if (G.state === "tutorial") interact();
    else if (G.state === "menu") startGame("arcade");
    else if (G.state === "over") startGame("arcade");
  }
});
window.addEventListener("keyup", (e) => {
  if (KEY_MAP[e.code]) { G.keys.delete(KEY_MAP[e.code]); e.preventDefault(); }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    G.keys.delete("sprint");
    e.preventDefault();
  }
});

// Touch D-pad
document.querySelectorAll(".dbtn").forEach(btn => {
  const dir = btn.dataset.dir;
  const press = (e) => { e.preventDefault(); G.touchDir = dir; btn.classList.add("pressed"); };
  const release = (e) => { e.preventDefault(); G.touchDir = null; btn.classList.remove("pressed"); };
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
});

interactBtn.addEventListener("click", () => { if (G.state === "play" || G.state === "tutorial") interact(); });
interactBtn.addEventListener("touchstart", (e) => { e.preventDefault(); if (G.state === "play" || G.state === "tutorial") interact(); }, { passive: false });

// Sprint button (mobile)
const sprintBtn = $("sprintBtn");
const sprintPress = (e) => { e.preventDefault(); G.touchSprint = true; sprintBtn.classList.add("pressed"); sprintBtn.classList.add("on"); };
const sprintRelease = (e) => { e.preventDefault(); G.touchSprint = false; sprintBtn.classList.remove("pressed"); sprintBtn.classList.remove("on"); };
sprintBtn.addEventListener("touchstart", sprintPress, { passive: false });
sprintBtn.addEventListener("touchend", sprintRelease, { passive: false });
sprintBtn.addEventListener("touchcancel", sprintRelease, { passive: false });
sprintBtn.addEventListener("mousedown", sprintPress);
sprintBtn.addEventListener("mouseup", sprintRelease);
sprintBtn.addEventListener("mouseleave", sprintRelease);

// ============================================================
// MOVEMENT & COLLISION
// ============================================================
function getMoveDir() {
  if (G.touchDir) return G.touchDir;
  // priority: last pressed; for simplicity pick any active
  for (const d of ["up","down","left","right"]) if (G.keys.has(d)) return d;
  return null;
}

function tryMove(dx, dy) {
  // player.x, player.y is top-left of bounding box. We'll use center-based for collision.
  const cx = player.x + dx;
  const cy = player.y + dy;
  // bounding box: player.w x player.h, centered on (cx, cy)
  const halfW = player.w / 2, halfH = player.h / 2;
  const left = cx - halfW, right = cx + halfW;
  const top = cy - halfH, bottom = cy + halfH;

  // check 4 corners in tile space
  const corners = [
    [Math.floor(left/TILE), Math.floor(top/TILE)],
    [Math.floor(right/TILE), Math.floor(top/TILE)],
    [Math.floor(left/TILE), Math.floor(bottom/TILE)],
    [Math.floor(right/TILE), Math.floor(bottom/TILE)],
  ];
  for (const [tx, ty] of corners) {
    if (isBlocked(tx, ty)) return false;
  }
  // clamp to canvas
  if (left < 0 || right > W || top < 0 || bottom > H) return false;
  player.x = cx; player.y = cy;
  return true;
}

function updatePlayer(dt) {
  const dir = getMoveDir();
  if (!dir) { player.moving = false; player.sprinting = false; return; }

  // Sprint if SHIFT held (keyboard) or SPRINT button held (mobile)
  const wantSprint = G.keys.has("sprint") || G.touchSprint;
  player.sprinting = wantSprint;
  const speed = BASE_SPEED * (wantSprint ? SPRINT_MULT : 1);

  let dx = 0, dy = 0;
  if (dir === "up") dy = -speed;
  else if (dir === "down") dy = speed;
  else if (dir === "left") dx = -speed;
  else if (dir === "right") dx = speed;
  player.facing = dir;

  // Try full move; if blocked, try sliding on one axis
  if (!tryMove(dx, dy)) {
    if (dx !== 0) tryMove(dx, 0);
    else if (dy !== 0) tryMove(0, dy);
  }
  player.moving = true;

  // step animation — faster cadence when sprinting
  const stepInterval = wantSprint ? 0.10 : 0.18;
  player.stepTimer += dt;
  if (player.stepTimer > stepInterval) {
    player.stepTimer = 0;
    player.stepPhase = (player.stepPhase + 1) % 2;
    sfxStep();
  }
}

// ============================================================
// INTERACTION
// ============================================================
// Find station the player is facing/adjacent to.
function getFacingStation() {
  // Player center tile
  const pcx = player.x / TILE;
  const pcy = player.y / TILE;
  // Tile in front based on facing
  let fx = pcx, fy = pcy;
  const off = 0.8;
  if (player.facing === "up")    fy -= off;
  else if (player.facing === "down")  fy += off;
  else if (player.facing === "left")  fx -= off;
  else if (player.facing === "right") fx += off;
  // find station whose tile-rect contains (fx, fy)
  for (const s of STATIONS) {
    if (fx >= s.x - 0.3 && fx < s.x + s.w + 0.3 &&
        fy >= s.y - 0.3 && fy < s.y + s.h + 0.3) {
      return s;
    }
  }
  // fallback: closest station within 1.5 tiles
  let best = null, bestDist = 2.0;
  for (const s of STATIONS) {
    const sx = s.x + s.w/2, sy = s.y + s.h/2;
    const d = Math.hypot(sx - pcx, sy - pcy);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

function interact() {
  const s = getFacingStation();
  if (!s) return;

  if (s.type === "ingredient") {
    // Pick up ingredient — allow stacking up to MAX_CARRY (3).
    // Only ingredients can be stacked; if the player is holding a completed
    // dish, they must deliver or trash it first.
    if (isHoldingDish()) { sfxError(); floatText("Holding a dish!", "#ff7b7b"); return; }
    if (player.heldStack.length >= MAX_CARRY) {
      sfxError();
      floatText("Hands full! (" + MAX_CARRY + "/" + MAX_CARRY + ")", "#ff7b7b");
      return;
    }
    player.heldStack.push(s.ingKey);
    sfxPickup();
    floatText("+" + INGREDIENTS[s.ingKey].name, "#ffd54a");
  }
  else if (s.type === "assembly") {
    if (isHoldingIngredient()) {
      // Transfer ALL carried ingredients onto the tray at once (up to tray max 4).
      // Any that don't fit stay in the player's hands.
      let added = 0;
      let leftover = [];
      for (const item of player.heldStack) {
        if (typeof item !== "string") { leftover.push(item); continue; }
        if (G.assemblyTray.length < 4) {
          G.assemblyTray.push(item);
          added++;
        } else {
          leftover.push(item);
        }
      }
      player.heldStack = leftover;
      if (added > 0) {
        // alternate sizzle/chop
        if (G.assemblyTray.length % 2 === 0) sfxChop(); else sfxSizzle();
        floatText("Placed " + added + " on tray", "#7bc5ff");
      } else {
        sfxError();
        floatText("Tray full!", "#ff7b7b");
      }
    }
    else if (isHoldingDish()) {
      // Can't place a completed dish back on the assembly table.
      sfxError();
      floatText("Deliver or trash the dish", "#ff7b7b");
    }
    else {
      // Not holding anything — try to pick up from the assembly table.
      // If tray exactly matches a recipe, pick up the assembled dish.
      const matchedDish = DISHES.find(d => arrEq(d.recipe, G.assemblyTray));
      if (matchedDish) {
        player.heldStack.push({ dish: matchedDish.key });
        G.assemblyTray = [];
        sfxPickup();
        floatText("Assembled: " + matchedDish.name, "#4ade80");
      } else if (G.assemblyTray.length > 0) {
        // pick up last ingredient back from the tray
        player.heldStack.push(G.assemblyTray.pop());
        sfxDrop();
        floatText("Took back ingredient", "#7bc5ff");
      } else {
        sfxError();
      }
    }
  }
  else if (s.type === "delivery") {
    // Serve the top held item if it's a completed dish.
    if (!isHoldingDish()) {
      sfxError();
      floatText("Hold a dish to serve!", "#ff7b7b");
      return;
    }
    const dishItem = topHeld();
    const dishKey = dishItem.dish;
    const slotIdx = (typeof s.slot === "number") ? s.slot : -1;
    const c = (slotIdx >= 0) ? G.customers[slotIdx] : null;

    if (c && !c.leaving && c.dishKey === dishKey) {
      // SUCCESS — correct dish to the right customer
      if (G.mode === "arcade") {
        G.score += 50;
        G.time = Math.min(60, G.time + 2);
        floatTextAtCustomer(slotIdx, "+$50", "#4ade80");
      } else {
        floatTextAtCustomer(slotIdx, "✓ Served!", "#4ade80");
      }
      sfxDing();
      c.leaving = true;
      const idx = slotIdx;
      setTimeout(() => { G.customers[idx] = null; }, 350);
      // Remove the served dish from the top of the stack
      player.heldStack.pop();
      updateHUD();
    } else {
      // WRONG — dish doesn't match this customer's order, or no customer here
      failDelivery(slotIdx);
    }
  }
  else if (s.type === "trash") {
    // Discard the top-most held item. If the player is holding nothing,
    // clear the entire assembly tray instead.
    if (player.heldStack.length > 0) {
      player.heldStack.pop();
      sfxTrash();
      floatText("Trashed item", "#ff7b7b");
    } else if (G.assemblyTray.length > 0) {
      G.assemblyTray = [];
      sfxTrash();
      floatText("Trashed tray", "#ff7b7b");
    } else {
      sfxError();
    }
  }
}

function failDelivery(slotIdx) {
  // Wrong dish served.
  if (G.mode === "arcade") {
    G.score -= 20; // allow negative
    floatTextAtCustomer((slotIdx === undefined ? -1 : slotIdx), "-$20", "#ff4d4d");
    sfxError();
    shakeScreen();
  } else {
    floatTextAtCustomer((slotIdx === undefined ? -1 : slotIdx), "Wrong dish", "#ff7b7b");
    sfxError();
  }
  // Remove the wrong dish from the top of the stack (it's been "served" wrongly)
  if (isHoldingDish()) player.heldStack.pop();
  updateHUD();
}

function arrEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ============================================================
// CUSTOMERS
// ============================================================
const CUST_FACES = ["🧑","👨","👩","🧓","👴","👵","🧑‍🦱","👩‍🦰","👨‍🦰","🧔","👲","👳","👦","👧"];

function currentPhase() {
  // Determine phase from elapsed time (60 - G.time)
  if (G.mode === "tutorial") return 1;
  const elapsed = 60 - G.time;
  if (elapsed < 20) return 1;
  if (elapsed < 40) return 2;
  return 3;
}

function updatePhase() {
  const p = currentPhase();
  if (p !== G.phase) {
    G.phase = p;
    showPhaseBadge(p);
  }
}

function showPhaseBadge(p) {
  const cfg = G.phaseCfg[p];
  phaseBadge.classList.remove("p1","p2","p3");
  phaseBadge.classList.add("p" + p);
  phaseNum.textContent = "Phase " + p;
  phaseText.textContent = cfg.label;
  showOverlay(phaseBadge);
}

function spawnCustomer() {
  const cfg = G.phaseCfg[G.phase];
  // Count current non-null, non-leaving customers
  const active = G.customers.filter(c => c && !c.leaving).length;
  if (active >= cfg.maxOrders) return;
  const emptyIdx = G.customers.findIndex(c => !c);
  if (emptyIdx === -1) return;
  const dish = DISHES[Math.floor(Math.random() * DISHES.length)];
  const face = CUST_FACES[Math.floor(Math.random() * CUST_FACES.length)];
  G.customers[emptyIdx] = {
    dishKey: dish.key,
    face: face,
    patience: cfg.patience,
    patienceMax: cfg.patience,
    fresh: true,
    angry: false,
    leaving: false,
  };
  sfxSpawn();
}

function patienceExpired(idx) {
  const c = G.customers[idx];
  if (!c) return;
  if (G.mode === "tutorial") return; // no penalties in tutorial
  G.score -= 20;
  floatTextAtCustomer(idx, "-$20", "#ff4d4d");
  sfxError();
  shakeScreen();
  c.angry = true;
  c.leaving = true;
  setTimeout(() => { G.customers[idx] = null; }, 350);
  updateHUD();
}

// ============================================================
// RENDERING
// ============================================================
let renderCustomersCanvas = true;

function tilePx(x) { return x * TILE; }

function drawFloor() {
  // Tile floor pattern
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = even ? "#1a1410" : "#221a14";
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }
  // subtle floor seams
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*TILE, 0); ctx.lineTo(x*TILE, H); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y*TILE); ctx.lineTo(W, y*TILE); ctx.stroke();
  }
}

function drawStations() {
  STATIONS.forEach(s => {
    const px = s.x * TILE, py = s.y * TILE;
    const pw = s.w * TILE, ph = s.h * TILE;

    if (s.type === "ingredient") {
      // Counter base
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#5a4028";
      ctx.fillRect(px+2, py+2, pw-4, ph-4);
      // ingredient emoji
      const ing = INGREDIENTS[s.ingKey];
      ctx.font = "22px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ing.emoji, px + pw/2, py + ph/2 - 2);
      // label below
      ctx.font = "8px sans-serif";
      ctx.fillStyle = "#ffd54a";
      ctx.fillText(ing.name.slice(0, 9), px + pw/2, py + ph - 4);
    }
    else if (s.type === "assembly") {
      // wooden table
      ctx.fillStyle = "#6b4423";
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(px+3, py+3, pw-6, ph-6);
      // wood grain lines
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px+5, py + i * ph/4);
        ctx.lineTo(px+pw-5, py + i * ph/4);
        ctx.stroke();
      }
      // tray contents
      const trayStartX = px + 8;
      const trayY = py + ph/2;
      G.assemblyTray.forEach((k, i) => {
        const ix = trayStartX + i * 26;
        ctx.font = "18px serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(INGREDIENTS[k].emoji, ix, trayY);
      });
      // label
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#ffd54a";
      ctx.textAlign = "center";
      ctx.fillText("ASSEMBLY", px + pw/2, py + 10);
    }
    else if (s.type === "delivery") {
      // Each delivery segment is a separate counter; draw as one visual style
      // with a neon strip on top and the segment number.
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(px+2, py+2, pw-4, ph-4);
      // neon strip on top
      ctx.fillStyle = "#ffd54a";
      ctx.fillRect(px, py, pw, 3);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#fff8e7";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("COUNTER " + (s.slot + 1), px + pw/2, py + ph/2 + 2);
    }
    else if (s.type === "trash") {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#444";
      ctx.fillRect(px+3, py+3, pw-6, ph-6);
      ctx.font = "20px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🗑️", px + pw/2, py + ph/2);
    }
  });
}

// ---- Text wrapping helper for Canvas ----
// Splits `text` into lines that each fit within `maxW` at the current ctx.font.
// Returns an array of line strings.
function wrapText(text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function drawCustomers() {
  for (let i = 0; i < G.customers.length; i++) {
    const c = G.customers[i];
    const slot = CUSTOMER_SLOTS[i];
    if (!c) continue;

    const cx = slot.x * TILE + TILE/2;
    const cy = slot.y * TILE + TILE/2;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 14, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // body color
    const bodyColors = ["#5b8cff","#ff7b7b","#4ade80","#ffd54a","#c8a3ff","#ff8a3d"];
    const bc = bodyColors[i % bodyColors.length];
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.fill();
    // face emoji
    ctx.font = "20px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(c.face, cx, cy);

    // ---- Speech bubble with dish + recipe (dynamically sized) ----
    const dish = DISHES.find(d => d.key === c.dishKey);
    const recipeNames = dish.recipe.map(k => INGREDIENTS[k].name);
    const recipeStr = recipeNames.join(" + ");

    // Layout constants
    const PAD = 8;                  // 8px internal padding on all sides
    const BUBBLE_MAX_W = 120;       // max bubble width
    const BUBBLE_MIN_W = 80;        // min bubble width
    const EMOJI_SIZE = 14;          // dish emoji font size
    const NAME_FONT_SIZE = dish.name.length > 14 ? 8 : (dish.name.length > 10 ? 9 : 10);
    const RECIPE_FONT_SIZE = recipeStr.length > 30 ? 7 : (recipeStr.length > 20 ? 8 : 9);
    const LINE_H = 12;              // line height for text
    const TOP_LINE_Y_OFFSET = 4;    // gap below the dish emoji line

    // --- Measure content to determine bubble dimensions ---
    // Top line: dish emoji (14px) + dish name (NAME_FONT_SIZE)
    ctx.font = "bold " + NAME_FONT_SIZE + "px sans-serif";
    const nameW = ctx.measureText(dish.name).width;
    const topLineH = Math.max(EMOJI_SIZE, NAME_FONT_SIZE) + 2;

    // Bottom line(s): recipe string, wrapped
    ctx.font = RECIPE_FONT_SIZE + "px sans-serif";
    const contentMaxW = BUBBLE_MAX_W - PAD * 2 - EMOJI_SIZE - 6; // leave room for emoji on top line
    const recipeLines = wrapText(recipeStr, BUBBLE_MAX_W - PAD * 2);
    const recipeH = recipeLines.length * LINE_H;

    // Bubble width: max of (name line width + emoji + padding) and (widest recipe line + padding)
    ctx.font = "bold " + NAME_FONT_SIZE + "px sans-serif";
    const topContentW = EMOJI_SIZE + 4 + ctx.measureText(dish.name).width;
    let recipeMaxW = 0;
    ctx.font = RECIPE_FONT_SIZE + "px sans-serif";
    for (const ln of recipeLines) {
      recipeMaxW = Math.max(recipeMaxW, ctx.measureText(ln).width);
    }
    const contentW = Math.max(topContentW, recipeMaxW);
    const bw = Math.max(BUBBLE_MIN_W, Math.min(BUBBLE_MAX_W, contentW + PAD * 2));
    const bh = PAD + topLineH + TOP_LINE_Y_OFFSET + recipeH + PAD;

    // Bubble position: centered above the customer, fully inside canvas top.
    // cy ≈ 120; bubble sits with its bottom at cy - 18 (above the head circle r=12).
    const bubbleBottomY = cy - 18;
    const bubbleX = cx;
    const bubbleTopY = bubbleBottomY - bh;
    const bubbleY = bubbleBottomY - bh / 2; // center for roundRect

    // ---- Patience bar (above the bubble) ----
    const barW = Math.min(bw - 8, 70), barH = 6;
    const barX = cx - barW/2;
    const barY = bubbleTopY - barH - 4; // 4px gap above bubble top
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.max(0, c.patience / c.patienceMax);
    let pcol = "#4ade80";
    if (pct < 0.5) pcol = "#ffd54a";
    if (pct < 0.25) pcol = "#ff4d4d";
    ctx.fillStyle = pcol;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // ---- Bubble background ----
    ctx.fillStyle = "rgba(255,248,231,0.97)";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.5;
    roundRect(bubbleX - bw/2, bubbleTopY, bw, bh, 7, true, true);
    // bubble tail pointing down at the customer
    ctx.beginPath();
    ctx.moveTo(bubbleX - 5, bubbleBottomY - 1);
    ctx.lineTo(bubbleX + 5, bubbleBottomY - 1);
    ctx.lineTo(bubbleX, bubbleBottomY + 6);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,248,231,0.97)";
    ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ---- Top line: dish emoji + dish name ----
    const topLineY = bubbleTopY + PAD + topLineH / 2;
    ctx.font = EMOJI_SIZE + "px serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(dish.emoji, bubbleX - bw/2 + PAD, topLineY);
    ctx.font = "bold " + NAME_FONT_SIZE + "px sans-serif";
    ctx.fillStyle = "#1a1a1a";
    // Truncate name if it still overflows the remaining width
    let nameToDraw = dish.name;
    const nameMaxW = bw - PAD * 2 - EMOJI_SIZE - 6;
    while (ctx.measureText(nameToDraw).width > nameMaxW && nameToDraw.length > 3) {
      nameToDraw = nameToDraw.slice(0, -1);
    }
    if (nameToDraw !== dish.name) nameToDraw = nameToDraw.slice(0, -1) + "…";
    ctx.fillText(nameToDraw, bubbleX - bw/2 + PAD + EMOJI_SIZE + 4, topLineY);

    // ---- Recipe line(s): ingredient names, wrapped inside the bubble ----
    ctx.font = RECIPE_FONT_SIZE + "px sans-serif";
    ctx.fillStyle = "#3a2a1a";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const recipeStartY = bubbleTopY + PAD + topLineH + TOP_LINE_Y_OFFSET;
    for (let li = 0; li < recipeLines.length; li++) {
      ctx.fillText(recipeLines[li], bubbleX - bw/2 + PAD, recipeStartY + li * LINE_H + LINE_H/2);
    }
  }
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawPlayer() {
  const cx = player.x, cy = player.y;

  // Sprint aura (subtle glow + speed lines behind)
  if (player.sprinting && player.moving) {
    ctx.fillStyle = "rgba(123,197,255,0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI*2);
    ctx.fill();
    // speed lines trailing opposite to facing
    ctx.strokeStyle = "rgba(123,197,255,0.55)";
    ctx.lineWidth = 2;
    let lx1=cx, ly1=cy, lx2=cx, ly2=cy;
    if (player.facing === "up")    { lx1=cx-10; ly1=cy+8;  lx2=cx-10; ly2=cy+16; }
    if (player.facing === "down")  { lx1=cx-10; ly1=cy-8;  lx2=cx-10; ly2=cy-16; }
    if (player.facing === "left")  { lx1=cx+8;  ly1=cy-4;  lx2=cx+16; ly2=cy-4; }
    if (player.facing === "right") { lx1=cx-8;  ly1=cy-4;  lx2=cx-16; ly2=cy-4; }
    ctx.beginPath(); ctx.moveTo(lx1,ly1); ctx.lineTo(lx2,ly2); ctx.stroke();
    let mx1=cx, my1=cy, mx2=cx, my2=cy;
    if (player.facing === "up")    { mx1=cx+10; my1=cy+8;  mx2=cx+10; my2=cy+16; }
    if (player.facing === "down")  { mx1=cx+10; my1=cy-8;  mx2=cx+10; my2=cy-16; }
    if (player.facing === "left")  { mx1=cx+8;  my1=cy+4;  mx2=cx+16; my2=cy+4; }
    if (player.facing === "right") { mx1=cx-8;  my1=cy+4;  mx2=cx-16; my2=cy+4; }
    ctx.beginPath(); ctx.moveTo(mx1,my1); ctx.lineTo(mx2,my2); ctx.stroke();
  }

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 13, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // legs (walk animation)
  const legOff = player.moving ? (player.stepPhase === 0 ? -2 : 2) : 0;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(cx - 6, cy + 6, 4, 8 + legOff);
  ctx.fillRect(cx + 2, cy + 6, 4, 8 - legOff);

  // body (chef whites)
  ctx.fillStyle = "#fff8e7";
  roundRect(cx - 10, cy - 6, 20, 14, 4, true, false);
  // apron strap
  ctx.fillStyle = "#ff7b7b";
  ctx.fillRect(cx - 10, cy - 2, 20, 3);

  // head
  ctx.fillStyle = "#f5c89b";
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 8, 0, Math.PI*2);
  ctx.fill();

  // chef hat
  ctx.fillStyle = "#fff8e7";
  ctx.fillRect(cx - 8, cy - 16, 16, 4);
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 18, 5, 0, Math.PI*2);
  ctx.arc(cx + 4, cy - 18, 5, 0, Math.PI*2);
  ctx.arc(cx, cy - 20, 5, 0, Math.PI*2);
  ctx.fill();

  // eyes (direction-based)
  ctx.fillStyle = "#1a1a1a";
  if (player.facing === "down") {
    ctx.fillRect(cx - 4, cy - 11, 2, 2);
    ctx.fillRect(cx + 2, cy - 11, 2, 2);
  } else if (player.facing === "up") {
    // no eyes visible (back of head) - draw hat puff lower
  } else if (player.facing === "left") {
    ctx.fillRect(cx - 5, cy - 11, 2, 2);
  } else if (player.facing === "right") {
    ctx.fillRect(cx + 3, cy - 11, 2, 2);
  }

  // held items above head — vertically stacked (up to MAX_CARRY=3)
  if (player.heldStack.length > 0) {
    // Render bottom-to-top so the top item is highest.
    // Start just above the chef hat (cy - 24) and go up 14px per item.
    const baseY = cy - 26;
    const stepY = 14;
    for (let i = 0; i < player.heldStack.length; i++) {
      const item = player.heldStack[i];
      const ix = cx;
      const iy = baseY - i * stepY;
      // plate background
      ctx.fillStyle = "#e5e5e5";
      ctx.beginPath();
      ctx.arc(ix, iy, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.stroke();
      // item emoji
      let emoji;
      if (typeof item === "string") {
        emoji = INGREDIENTS[item].emoji;
      } else if (item.dish) {
        const d = DISHES.find(dd => dd.key === item.dish);
        emoji = d.emoji;
      }
      ctx.font = "14px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(emoji, ix, iy);
    }
    // Carry-count badge (small circle at top-right of the highest item)
    if (player.heldStack.length > 1) {
      const badgeX = cx + 10;
      const badgeY = baseY - (player.heldStack.length - 1) * stepY - 8;
      ctx.fillStyle = "#ffd54a";
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "bold 8px sans-serif";
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(player.heldStack.length, badgeX, badgeY);
    }
  }

  // facing indicator arrow (small)
  if (player.moving || true) {
    ctx.fillStyle = "rgba(255,213,74,0.9)";
    ctx.beginPath();
    let ax = cx, ay = cy + 16;
    if (player.facing === "up") { ax = cx; ay = cy - 22; }
    else if (player.facing === "down") { ax = cx; ay = cy + 20; }
    else if (player.facing === "left") { ax = cx - 16; ay = cy; }
    else if (player.facing === "right") { ax = cx + 16; ay = cy; }
    ctx.arc(ax, ay, 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawHighlightFacing() {
  const s = getFacingStation();
  if (!s) return;
  const px = s.x * TILE, py = s.y * TILE;
  const pw = s.w * TILE, ph = s.h * TILE;
  ctx.strokeStyle = "rgba(255,213,74,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(px, py, pw, ph);
  ctx.setLineDash([]);
}

function drawTrayPanel() {
  // small panel bottom-left showing current assembly tray
  const px = 8, py = H - 56;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(px, py, 180, 48, 8, true, false);
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#ffd54a";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("ASSEMBLY TRAY", px + 8, py + 4);
  G.assemblyTray.forEach((k, i) => {
    const ix = px + 8 + i * 24;
    const iy = py + 20;
    ctx.font = "16px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(INGREDIENTS[k].emoji, ix + 8, iy + 8);
  });
}

function drawHeldPanel() {
  const px = W - 188, py = H - 56;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(px, py, 180, 48, 8, true, false);
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#7bc5ff";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("CARRYING (" + player.heldStack.length + "/" + MAX_CARRY + ")", px + 8, py + 4);
  if (player.heldStack.length === 0) return;
  // Show up to 3 items horizontally
  for (let i = 0; i < player.heldStack.length && i < MAX_CARRY; i++) {
    const item = player.heldStack[i];
    const ix = px + 14 + i * 52;
    const iy = py + 30;
    let emoji, label;
    if (typeof item === "string") {
      emoji = INGREDIENTS[item].emoji;
      label = INGREDIENTS[item].name;
    } else if (item.dish) {
      const d = DISHES.find(dd => dd.key === item.dish);
      emoji = d.emoji; label = d.name;
    }
    // plate
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(ix, iy, 11, 0, Math.PI*2);
    ctx.fill();
    ctx.font = "16px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(emoji, ix, iy);
    ctx.font = "7px sans-serif";
    ctx.fillStyle = "#fff8e7";
    ctx.fillText(label.slice(0, 10), ix, iy + 13);
  }
}

// ============================================================
// FLOATING TEXT (HTML overlay on canvas-wrap)
// ============================================================
function floatText(text, color) {
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;
  el.style.color = color;
  // place near player's screen position
  const wrap = canvasWrap;
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  // scale factor between canvas internal coords and displayed coords
  const sx = canvasRect.width / W;
  const sy = canvasRect.height / H;
  const left = (canvasRect.left - wrapRect.left) + player.x * sx;
  const top = (canvasRect.top - wrapRect.top) + (player.y - 30) * sy;
  el.style.left = left + "px";
  el.style.top = top + "px";
  el.style.transform = "translate(-50%, 0)";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function floatTextAtCustomer(idx, text, color) {
  let slot;
  if (idx === -1) {
    // center top
    slot = { x: 11, y: 0.5 };
  } else {
    slot = CUSTOMER_SLOTS[idx];
  }
  const wrap = canvasWrap;
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const sx = canvasRect.width / W;
  const sy = canvasRect.height / H;
  const left = (canvasRect.left - wrapRect.left) + (slot.x * TILE + TILE/2) * sx;
  const top = (canvasRect.top - wrapRect.top) + (slot.y * TILE) * sy;
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;
  el.style.color = color;
  el.style.left = left + "px";
  el.style.top = top + "px";
  el.style.transform = "translate(-50%, 0)";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function shakeScreen() {
  app.classList.remove("shake");
  void app.offsetWidth;
  app.classList.add("shake");
  setTimeout(() => app.classList.remove("shake"), 350);
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
  scoreEl.textContent = "$" + G.score;
  if (G.mode === "tutorial") {
    timeEl.textContent = "∞";
    timeEl.classList.remove("danger");
  } else {
    const tInt = Math.ceil(G.time);
    timeEl.textContent = tInt;
    if (tInt <= 10) timeEl.classList.add("danger");
    else timeEl.classList.remove("danger");
  }
  highEl.textContent = "$" + G.high;
}

// ============================================================
// GAME LOOP
// ============================================================
let lastTs = 0;
function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  // Clear & draw
  ctx.fillStyle = "#15110a";
  ctx.fillRect(0, 0, W, H);
  drawFloor();
  drawStations();
  drawCustomers();
  drawHighlightFacing();
  drawPlayer();
  drawTrayPanel();
  drawHeldPanel();

  if (G.state === "play") {
    updatePlayer(dt);

    // timer
    G.time -= dt;
    updatePhase();
    if (G.time <= 10) {
      const wholePrev = Math.ceil(G.time + dt);
      const wholeNow = Math.ceil(G.time);
      if (wholePrev !== wholeNow && wholeNow >= 0) sfxTick();
    }
    if (G.time <= 0) {
      G.time = 0;
      endGame();
    }

    // patience
    for (let i = 0; i < G.customers.length; i++) {
      const c = G.customers[i];
      if (!c || c.leaving) continue;
      c.patience -= dt;
      if (c.patience <= 0) {
        patienceExpired(i);
      }
    }

    // spawn — uses phase-based interval.
    // When a counter frees up (a customer left), we fast-forward the spawn
    // accumulator so a new order appears within ~1s instead of waiting a
    // full interval. This keeps 2–3 counters consistently occupied.
    const cfg = G.phaseCfg[G.phase];
    G.spawnAcc += dt * 1000;
    const interval = Math.max(1000, cfg.spawnInterval - (60 - G.time) * 8);
    // If there's an empty slot and we're under maxOrders, also nudge the
    // accumulator up so spawns trigger quickly after a slot frees.
    const active = G.customers.filter(c => c && !c.leaving).length;
    const hasEmpty = G.customers.some(c => !c);
    if (hasEmpty && active < cfg.maxOrders && G.spawnAcc < interval - 200) {
      G.spawnAcc = interval - 200; // spawn within ~200ms
    }
    if (G.spawnAcc >= interval) {
      G.spawnAcc = 0;
      spawnCustomer();
    }

    updateHUD();
  }
  else if (G.state === "tutorial") {
    updatePlayer(dt);
    updateTutorial();
  }

  requestAnimationFrame(loop);
}

// ============================================================
// START / END
// ============================================================
function resetCommon() {
  audio();
  G.customers = [null, null, null];
  G.assemblyTray = [];
  G.spawnAcc = 0;
  G.phase = 1;
  G.keys.clear();
  G.touchDir = null;
  G.touchSprint = false;
  player.x = 11 * TILE;
  player.y = 11 * TILE;
  player.facing = "down";
  player.stepPhase = 0;
  player.stepTimer = 0;
  player.sprinting = false;
  player.heldStack = [];
  // Hide ALL overlays / modals / prompts explicitly — both class and inline style
  // to guarantee they're fully removed from the visual stack.
  hideOverlay(startScreen);
  hideOverlay(overScreen);
  hideOverlay(tutorialModal);
  hideOverlay(tutPrompt);
  hideOverlay(phaseBadge);
}

// Robust overlay-hider: removes .hidden class AND sets display:none inline,
// so no CSS specificity issue can keep an element visible.
function hideOverlay(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}
function showOverlay(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = "";
}

function startGame(mode) {
  mode = mode || "arcade";
  resetCommon();
  G.mode = mode;
  G.state = "play";
  G.time = 60;
  G.score = 0;
  G.tutStep = 0;
  showPhaseBadge(1);
  updateHUD();
  sfxStart();
  bgmStart();
  // initial spawn after a short delay
  setTimeout(() => { if (G.state === "play") spawnCustomer(); }, 600);
}

// ---- Tutorial mode ----
// 5-step guided loop using HK Milk Tea (Tea + Evap Milk).
// No timer, no score, no pressure. One patient customer waits at Counter 1.
const TUT_STEPS = [
  { no: 1, text: 'Walk to the <b>Tea</b> counter (left side) and press <b>INTERACT</b> to grab it. You can carry up to <b>3 ingredients</b> at once!' },
  { no: 2, text: 'Now walk to the <b>Evaporated Milk</b> counter and press <b>INTERACT</b> to grab it. Both ingredients stack above your head.' },
  { no: 3, text: 'Bring both to the <b>Assembly Table</b> (center). Press <b>INTERACT</b> once — all carried ingredients drop onto the tray at once. The dish auto-assembles — press <b>INTERACT</b> again to pick up the <b>Milk Tea</b>.' },
  { no: 4, text: 'Carry the Milk Tea to <b>Counter 1</b> (top-left) and press <b>INTERACT</b> to serve the customer.' },
  { no: 5, text: '🎉 Tutorial complete! You\'re ready for the lunch rush. Press <b>PLAY GAME</b> on the title screen to start the real 60-second shift.' },
];

function startTutorial() {
  resetCommon();
  G.mode = "tutorial";
  G.state = "tutorial";
  G.time = 60;       // not used in tutorial, but kept for HUD display
  G.score = 0;
  G.tutStep = 0;
  G.tutTargetDish = "milktea";
  hideOverlay(phaseBadge);
  // Spawn one patient customer at slot 0 ordering Milk Tea
  G.customers[0] = {
    dishKey: "milktea",
    face: "🧑",
    patience: 999,       // effectively infinite
    patienceMax: 999,
    fresh: true,
    angry: false,
    leaving: false,
  };
  // Display the tutorial prompt
  showOverlay(tutPrompt);
  renderTutPrompt();
  sfxStart();
  bgmStart();
  updateHUD();
}

function renderTutPrompt() {
  const step = TUT_STEPS[G.tutStep];
  tutStepNo.textContent = "Step " + step.no + " / " + TUT_STEPS.length;
  tutStepText.innerHTML = step.text;
  // progress dots
  tutDots.innerHTML = "";
  for (let i = 0; i < TUT_STEPS.length; i++) {
    const d = document.createElement("span");
    d.className = "dot" + (i < G.tutStep ? " done" : (i === G.tutStep ? " cur" : ""));
    tutDots.appendChild(d);
  }
}

function tutAdvance() {
  G.tutStep++;
  if (G.tutStep >= TUT_STEPS.length) {
    G.tutStep = TUT_STEPS.length - 1;
  }
  renderTutPrompt();
  sfxDing();
  if (G.tutStep === TUT_STEPS.length - 1) {
    // last step shown after serve
  }
}

function tutExit() {
  G.state = "menu";
  G.mode = "none";
  G.tutStep = 0;
  G.customers = [null, null, null];
  G.assemblyTray = [];
  player.heldStack = [];
  hideOverlay(tutPrompt);
  hideOverlay(phaseBadge);
  showOverlay(startScreen);
  bgmStop();
}

// Check tutorial progress on each frame based on player state
function updateTutorial() {
  if (G.tutStep === 0) {
    // Step 1: picked up Tea (it's somewhere in the carried stack)
    if (player.heldStack.includes("tea")) tutAdvance();
  }
  else if (G.tutStep === 1) {
    // Step 2: picked up Evap Milk (in the stack alongside Tea, or Tea already on tray)
    if (player.heldStack.includes("milk")) tutAdvance();
    else if (G.assemblyTray.includes("tea") && player.heldStack.includes("milk")) tutAdvance();
  }
  else if (G.tutStep === 2) {
    // Step 3: assembled Milk Tea and picked it up (stack top is the dish)
    if (isHoldingDish() && topHeld().dish === "milktea") tutAdvance();
  }
  else if (G.tutStep === 3) {
    // Step 4: served the customer (customer becomes null/leaving)
    const c = G.customers[0];
    if (!c || c.leaving) {
      tutAdvance();
    }
  }
  // Step 5 is the completion message — no further action; player exits manually
}

function endGame() {
  G.state = "over";
  G.mode = "none";
  bgmStop();
  hideOverlay(phaseBadge);
  hideOverlay(tutPrompt);
  hideOverlay(tutorialModal);
  sfxGameOver();
  if (G.score > G.high) {
    G.high = G.score;
    try { localStorage.setItem("cct_high", String(G.high)); } catch(e) {}
    overHighEl.textContent = "★ New High Score! ★";
  } else {
    overHighEl.textContent = "High Score: $" + G.high;
  }
  finalScoreEl.textContent = "$" + G.score;
  let rank, color, bg, sub;
  if (G.score < 200) {
    rank = "Trainee Waiter";
    color = "#ff7b7b"; bg = "rgba(255,123,123,0.12)";
    sub = "Rough first shift — keep practicing!";
  } else if (G.score <= 500) {
    rank = "Experienced Captain";
    color = "#ffd54a"; bg = "rgba(255,213,74,0.12)";
    sub = "Solid lunch service!";
  } else {
    rank = "Legendary Master Chef";
    color = "#4ade80"; bg = "rgba(74,222,128,0.12)";
    sub = "The kitchen bows to you!";
  }
  rankBadgeEl.textContent = rank;
  rankBadgeEl.style.color = color;
  rankBadgeEl.style.borderColor = color;
  rankBadgeEl.style.background = bg;
  overSubEl.textContent = sub;
  if (G.score > 500) burstConfetti();
  showOverlay(overScreen);
}

// ============================================================
// CONFETTI
// ============================================================
function burstConfetti() {
  const colors = ["#ffd54a","#ff7b7b","#4ade80","#ff8a3d","#7bc5ff","#ff5cb4"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.left = (Math.random()*100) + "%";
    p.style.transform = "rotate(" + (Math.random()*360) + "deg)";
    p.style.transition = "top " + (1.6 + Math.random()*1.2) + "s cubic-bezier(.4,.2,.6,1), transform " + (1.6 + Math.random()*1.2) + "s linear, opacity 0.4s ease-in " + 1.4 + "s";
    overScreen.appendChild(p);
    requestAnimationFrame(() => {
      p.style.top = (70 + Math.random()*30) + "%";
      p.style.transform = "translateX(" + ((Math.random()-0.5)*200) + "px) rotate(" + (Math.random()*720) + "deg)";
      setTimeout(() => { p.style.opacity = "0"; }, 1400);
    });
    setTimeout(() => p.remove(), 3200);
  }
}

// ============================================================
// COPY SCORE
// ============================================================
function copyScore() {
  const rank = G.score < 200 ? "Trainee Waiter"
             : G.score <= 500 ? "Experienced Captain"
             : "Legendary Master Chef";
  const txt = "🍽 Cha Chaan Teng Rush — Kitchen Arcade\n💰 I earned $" + G.score + " HKD!\n🏆 Rank: " + rank + "\n\nCan you beat me?";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      copyBtn.textContent = "✓ Copied!";
      sfxDing();
      setTimeout(() => copyBtn.textContent = "📋 Copy Score to Share", 1800);
    }).catch(() => fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); copyBtn.textContent = "✓ Copied!"; }
  catch(e) { copyBtn.textContent = "✗ Copy failed"; }
  document.body.removeChild(ta);
  setTimeout(() => copyBtn.textContent = "📋 Copy Score to Share", 1800);
}

// ============================================================
// EVENT BINDINGS
// ============================================================
// Title screen buttons
playBtn.addEventListener("click", () => startGame("arcade"));
playTutBtn.addEventListener("click", () => startTutorial());
replayBtn.addEventListener("click", () => startGame("arcade"));
copyBtn.addEventListener("click", copyScore);

// Mute button (works in any state)
muteBtn.addEventListener("click", () => {
  audio(); // ensure context
  bgmToggleMute();
});

// Tutorial exit
tutExitBtn.addEventListener("click", tutExit);

// How-to-Play / Recipes modal (slide-out style — we reuse the tutorial modal)
function openTutorial() {
  showOverlay(tutorialModal);
}
function closeTutorial() {
  hideOverlay(tutorialModal);
}
howToPlayBtn.addEventListener("click", openTutorial);
tutCloseBtn.addEventListener("click", closeTutorial);
tutStartBtn.addEventListener("click", () => {
  closeTutorial();
  startGame("arcade");
});
// Allow SPACE/E/Enter to also start arcade mode from the title screen or tutorial modal
window.addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "KeyE" || e.code === "Enter")) {
    // If tutorial modal is open → start arcade
    if (!tutorialModal.classList.contains("hidden")) {
      e.preventDefault();
      closeTutorial();
      startGame("arcade");
    }
    // (gameplay interact is handled by the earlier keydown listener)
  }
});

// Prevent context menu on long-press
window.addEventListener("contextmenu", (e) => {
  if (e.target.closest("canvas, .dbtn, .action-btn, .sprint-btn, .mute-btn, .title-btn-primary, .title-btn-secondary, .title-btn-tertiary")) e.preventDefault();
});

// Resize canvas display to fit container while keeping internal resolution
function fitCanvas() {
  const wrap = canvasWrap;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  const aspect = W / H;
  let dispW = wrapW, dispH = wrapW / aspect;
  if (dispH > wrapH) { dispH = wrapH; dispW = wrapH * aspect; }
  canvas.style.width = dispW + "px";
  canvas.style.height = dispH + "px";
}
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", fitCanvas);
setTimeout(fitCanvas, 50);

// Initialize HUD
updateHUD();
// (Title screen is shown by default; BGM starts on first user gesture due to
// browser autoplay policies — it kicks in when the player taps PLAY.)
// Start render loop even on menu (so the kitchen shows behind title screen)
requestAnimationFrame(loop);

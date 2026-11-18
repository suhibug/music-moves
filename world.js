// The objects in the air and how your hands play with them. Pure logic: no drawing, no sound.
// Positions are in screen pixels of the video. It returns "events" (grab, throw, catch...)
// that sound.js turns into music.
import { SPRITES } from "./sprites.js";

export const TUNE = {
  size: 0.16,          // object size, as a share of the screen's short side
  reach: 0.8,          // how close (in object sizes) a hand must be to grab or bat
  throwSpeed: 0.9,     // letting go faster than this (screens per second) is a throw
  batSpeed: 1.6,       // an open hand moving this fast through an object bats it
  breakSpeed: 3.2,     // hitting a wall faster than this smashes it
  crushAt: 0.42,       // squeezing with two hands below this size crushes it
  gravity: 0.9,        // pull on thrown objects (floating ones hang in the air)
  bounce: 0.55,        // how much speed survives a bounce
  respawnMs: 2500,     // a new object appears this long after one breaks
};

let nextSeed = 1;

export function createWorld() {
  return { w: 1, h: 1, objects: [], pieces: [], hands: [blankHand(), blankHand()], pending: [] };
}
const blankHand = () => ({ seen: false, x: 0, y: 0, vx: 0, vy: 0, closed: false, wasClosed: false, holding: null, lastBat: 0 });

export function addObject(world, type, colors, x, y) {
  const sp = SPRITES[type];
  world.objects.push({
    type, material: sp.material, art: sp.art, colors, seed: nextSeed++,
    x, y, vx: 0, vy: 0, homeX: x, homeY: y, angle: (Math.random() - 0.5) * 0.6, spin: 0, spinY: 0,
    stretch: 1, size: TUNE.size * Math.min(world.w, world.h), state: "float", holders: [], lastNote: 0, bob: Math.random() * 6,
  });
}

// hands: up to two { seen, x, y, closed } in screen pixels, or null when the camera has no new
// frame yet (hands keep their last state). handDt: seconds since the last camera frame.
// dt: seconds since the last screen frame. now: ms. respawn(): returns { type, colors }.
export function step(world, hands, dt, now, respawn, handDt = dt) {
  const ev = [], S = Math.min(world.w, world.h);
  const emit = (type, o, extra = {}) => ev.push({ type, material: o.material, height: 1 - o.y / world.h, ...extra });

  // Hands: position, speed, and whether they just closed or opened.
  if (hands) {
    hands.forEach((h, i) => {
      const me = world.hands[i];
      if (!h.seen) { if (me.holding) letGo(world, me, i, emit, true, S, now); me.seen = false; me.closed = false; me.wasClosed = false; return; }
      if (me.seen && handDt > 0) {
        me.vx += ((h.x - me.x) / handDt - me.vx) * 0.5;
        me.vy += ((h.y - me.y) / handDt - me.vy) * 0.5;
      } else { me.vx = 0; me.vy = 0; }
      Object.assign(me, { seen: true, x: h.x, y: h.y, wasClosed: me.closed, closed: h.closed });
    });
    world.hands.forEach((me, i) => {
      if (!me.seen) return;
      if (me.closed && !me.wasClosed) grab(world, me, i, emit, S);
      if (!me.closed && me.wasClosed && me.holding) letGo(world, me, i, emit, false, S, now);
    });
  }

  for (const o of world.objects) {
    if (o.state === "held") moveHeld(world, o, now, emit, S);
    else moveFree(world, o, dt, now, emit, S);
  }

  // Broken objects come back as something new after a moment.
  for (const o of world.objects.filter((x) => x.state === "broken")) {
    if (now - o.brokeAt > TUNE.respawnMs) {
      const next = respawn();
      Object.assign(o, { ...SPRITES[next.type], type: next.type, material: SPRITES[next.type].material, colors: next.colors, seed: nextSeed++ });
      Object.assign(o, { x: o.homeX, y: o.homeY, vx: 0, vy: 0, stretch: 1, state: "float", holders: [] });
      emit("appear", o);
    }
  }

  for (const p of world.pieces) {
    p.vy += TUNE.gravity * 1.4 * S * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt / 1.6;
  }
  world.pieces = world.pieces.filter((p) => p.life > 0);
  return ev;
}

function grab(world, me, i, emit, S) {
  let best = null, bestD = Infinity;
  for (const o of world.objects) {
    if (o.state === "broken") continue;
    const d = Math.hypot(o.x - me.x, o.y - me.y);
    if (d < TUNE.reach * o.size * Math.max(1, o.stretch) && d < bestD) { best = o; bestD = d; }
  }
  if (!best) return;
  me.holding = best;
  if (best.holders.length === 1 && best.holders[0] !== i) {
    // Second hand on the same object: now you can stretch and squeeze it.
    const other = world.hands[best.holders[0]];
    best.holders.push(i);
    best.baseDist = Math.max(10, Math.hypot(other.x - me.x, other.y - me.y));
    best.baseStretch = best.stretch;
    emit("stretchStart", best);
    return;
  }
  emit(best.state === "flying" ? "catch" : "grab", best);
  best.holders = [i];
  best.state = "held";
}

function letGo(world, me, i, emit, lost, S = 1, now = 0) {
  const o = me.holding;
  me.holding = null;
  me.lastBat = now + 200; // a hand that just threw something doesn't bat for a moment
  if (!o) return;
  o.holders = o.holders.filter((k) => k !== i);
  if (o.holders.length) { emit("stretchEnd", o); return; }
  o.vx = lost ? 0 : me.vx;
  o.vy = lost ? 0 : me.vy;
  const speed = Math.hypot(o.vx, o.vy) / S;
  o.spin = o.vx / S * 2;
  o.state = speed > TUNE.throwSpeed ? "flying" : "float";
  if (o.state === "float") { o.homeX = o.x; o.homeY = o.y; }
  emit(o.state === "flying" ? "throw" : "release", o, { speed });
}

function moveHeld(world, o, now, emit, S) {
  const hs = o.holders.map((k) => world.hands[k]);
  if (hs.length === 2) {
    const [a, b] = hs, d = Math.hypot(a.x - b.x, a.y - b.y);
    o.x += ((a.x + b.x) / 2 - o.x) * 0.6;
    o.y += ((a.y + b.y) / 2 - o.y) * 0.6;
    o.stretch = Math.min(3, Math.max(0.3, o.baseStretch * d / o.baseDist));
    o.angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (o.angle > Math.PI / 2) o.angle -= Math.PI; else if (o.angle < -Math.PI / 2) o.angle += Math.PI;
    emit("stretch", o, { amount: o.stretch });
    if (o.stretch < TUNE.crushAt) { breakApart(world, o, now, S); for (const h of hs) h.holding = null; emit("crush", o); }
    return;
  }
  const h = hs[0];
  o.x += (h.x - o.x) * 0.6;
  o.y += (h.y - o.y) * 0.6;
  o.spinY += h.vx / S * 0.05;
  // Moving while holding plays notes, at most about five a second. Higher = higher note.
  if (Math.hypot(h.vx, h.vy) / S > 1 && now - o.lastNote > 180) { o.lastNote = now; emit("move", o); }
}

function moveFree(world, o, dt, now, emit, S) {
  if (o.state === "broken") return;
  // Open hands moving fast bat objects out of the way.
  for (const h of world.hands) {
    if (!h.seen || h.closed || now - h.lastBat < 300) continue;
    const speed = Math.hypot(h.vx, h.vy) / S;
    if (speed > TUNE.batSpeed && Math.hypot(o.x - h.x, o.y - h.y) < TUNE.reach * o.size) {
      o.vx += h.vx * 0.9; o.vy += h.vy * 0.9; o.spin = h.vx / S * 3;
      o.state = "flying"; h.lastBat = now;
      emit("bat", o, { speed });
    }
  }
  if (o.state === "flying") {
    o.vy += TUNE.gravity * S * dt;
    o.vx *= 1 - 0.4 * dt; o.vy *= 1 - 0.4 * dt;
    if (Math.hypot(o.vx, o.vy) / S < 0.25) { o.state = "float"; o.homeX = o.x; o.homeY = Math.min(o.y, world.h * 0.7); }
  } else {
    // Floating: drift gently around a resting spot, bobbing like it's in water.
    o.bob += dt;
    o.vx += ((o.homeX - o.x) * 1.5 - o.vx * 2) * dt;
    o.vy += ((o.homeY + Math.sin(o.bob * 1.3) * S * 0.02 - o.y) * 1.5 - o.vy * 2) * dt;
  }
  o.x += o.vx * dt; o.y += o.vy * dt;
  o.angle += o.spin * dt; o.spin *= 1 - 0.8 * dt;
  o.spinY += (o.vx / S) * 2 * dt + 0.3 * dt;
  o.stretch += (1 - o.stretch) * Math.min(1, 3 * dt);

  // Walls, floor and ceiling.
  const r = o.size / 2;
  const walls = [
    [o.x < r, () => { o.x = r; return -o.vx; }, "side", (v) => (o.vx = v)],
    [o.x > world.w - r, () => { o.x = world.w - r; return -o.vx; }, "side", (v) => (o.vx = v)],
    [o.y < r, () => { o.y = r; return -o.vy; }, "ceiling", (v) => (o.vy = v)],
    [o.y > world.h - r, () => { o.y = world.h - r; return -o.vy; }, "floor", (v) => (o.vy = v)],
  ];
  for (const [hitIt, clampIt, where, set] of walls) {
    if (!hitIt) continue;
    const back = clampIt(), speed = Math.abs(back) / S;
    if (o.state === "flying" && speed > TUNE.breakSpeed) { breakApart(world, o, now, S); emit("shatter", o, { speed }); return; }
    set(back * TUNE.bounce);
    if (speed > 0.3) emit("bounce", o, { speed, where });
  }
}

// Smash: every pixel of the drawing becomes a piece that flies out and falls.
function breakApart(world, o, now, S) {
  const cell = o.size / 12, cos = Math.cos(o.angle), sin = Math.sin(o.angle);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
    const ch = o.art[r][c];
    if (ch === ".") continue;
    const lx = (c - 5.5) * cell * o.stretch, ly = (r - 5.5) * cell;
    const x = o.x + lx * cos - ly * sin, y = o.y + lx * sin + ly * cos;
    const burst = S * (0.6 + Math.random() * 0.9);
    const a = Math.atan2(y - o.y, x - o.x) + (Math.random() - 0.5) * 0.8;
    world.pieces.push({ x, y, vx: Math.cos(a) * burst + o.vx * 0.3, vy: Math.sin(a) * burst + o.vy * 0.3 - S * 0.3, size: cell, color: o.colors["abcd".indexOf(ch)], life: 1 });
  }
  o.state = "broken";
  o.brokeAt = now;
  o.holders = [];
}

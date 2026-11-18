// Turns body points from the camera into movement readings and dance styles.
// Pure math, no camera, page or sound code, so it is easy to test and tune.

// MediaPipe Pose gives 33 points. These are the ones used here.
export const P = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
};
const MOVERS = [P.nose, P.lElbow, P.rElbow, P.lWrist, P.rWrist, P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle];

// Starting guesses. Tune these with real dance videos (like Trail Prep's GPX tuning).
// Distances are in "torso lengths" (shoulders to hips), so they work at any distance from the camera.
export const TUNING = {
  fullSpeed: 3,       // torso lengths per second that counts as 100% energy
  smoothing: 0.06,    // 0 to 1: higher reacts faster, lower is steadier
  flowBelow: 0.18,    // energy under this, with no steady bounce, plays Flow
  raveAt: 0.6,        // energy over this (or repeated jumps) plays Rave
  houseFrom: 112,     // a steady bounce at or above this many per minute plays House, below it Hip hop
  holdMs: 2500,       // a new style must last this long before the music switches
  bounceDepth: 0.05,  // how far the hips must dip to count as one bounce
  jumpHeight: 0.25,   // how far both ankles must lift off the floor to count as a jump
  handHit: 2.2,       // wrist speed that counts as a hand move (plays a note)
  stepSpeed: 1.2,     // ankle speed downward that counts as a foot coming down
  stillBelow: 0.04,   // energy under this counts as standing still
  freezeMs: 1200,     // standing still this long fades the music down
  minSeen: 0.5,       // how sure the camera must be that a point is really there
};

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seen = (p) => p && (p.visibility ?? 1) >= TUNING.minSeen;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createTracker() {
  return {
    prev: null, prevT: 0, energy: 0,
    dir: 1, ext: null, bottoms: [],       // bounce
    ankles: [], jumps: [], jumpReady: true, // jumps
    handFast: { l: false, r: false },     // hand moves
    falling: { l: false, r: false },      // steps
    stillSince: null,
    style: "flow", wantStyle: "flow", wantSince: 0,
  };
}

// Reading when nobody is in view: let the energy fade and keep the music going.
export function away(tr, t) {
  tr.prev = null;
  tr.energy *= 0.95;
  return { visible: false, energy: tr.energy, bpm: null, jumped: false, armsUp: false, hands: [], steps: 0, frozen: false, style: tr.style };
}

// lm: one person's 33 points (x, y from 0 to 1, y grows downward). t: time in milliseconds.
export function update(tr, lm, t) {
  const torsoSeen = [P.lShoulder, P.rShoulder, P.lHip, P.rHip].every((i) => seen(lm[i]));
  if (!torsoSeen) return away(tr, t);
  const shoulders = mid(lm[P.lShoulder], lm[P.rShoulder]);
  const hips = mid(lm[P.lHip], lm[P.rHip]);
  const torso = Math.max(dist(shoulders, hips), 0.01);
  const dt = tr.prev ? (t - tr.prevT) / 1000 : 0;
  const fresh = dt > 0 && dt < 0.5; // only compare with the frame just before
  const both = (i) => fresh && seen(lm[i]) && seen(tr.prev[i]);
  const speedOf = (i) => (both(i) ? dist(lm[i], tr.prev[i]) / torso / dt : 0);
  // Hands are measured against the shoulders and feet against the hips, so a whole-body
  // bounce or jump doesn't count as a hand move or a step.
  const was = (a, b) => mid(tr.prev[a], tr.prev[b]);
  const handSpeed = (i) => {
    if (!both(i)) return 0;
    const now = mid(lm[P.lShoulder], lm[P.rShoulder]), before = was(P.lShoulder, P.rShoulder);
    const dx = (lm[i].x - now.x) - (tr.prev[i].x - before.x), dy = (lm[i].y - now.y) - (tr.prev[i].y - before.y);
    return Math.hypot(dx, dy) / torso / dt;
  };
  const footFall = (i) => {
    if (!both(i)) return 0;
    const now = mid(lm[P.lHip], lm[P.rHip]), before = was(P.lHip, P.rHip);
    return ((lm[i].y - now.y) - (tr.prev[i].y - before.y)) / torso / dt;
  };

  // Energy: how fast the whole body moves, smoothed so the music doesn't flicker.
  if (fresh) {
    const moved = MOVERS.filter((i) => seen(lm[i]) && seen(tr.prev[i]));
    const speed = moved.length ? moved.reduce((s, i) => s + speedOf(i), 0) / moved.length : 0;
    tr.energy += (clamp01(speed / TUNING.fullSpeed) - tr.energy) * TUNING.smoothing;
  }

  // Hand moves: a wrist that suddenly moves fast plays a note. Higher hand = higher note.
  const hands = [];
  for (const [side, i] of [["l", P.lWrist], ["r", P.rWrist]]) {
    const fast = handSpeed(i) > TUNING.handHit;
    if (fast && !tr.handFast[side]) hands.push(clamp01((hips.y - lm[i].y) / (2.2 * torso)));
    tr.handFast[side] = fast;
  }

  // Steps: a foot moving down fast, then stopping, is a step or stomp.
  let steps = 0;
  for (const [side, i] of [["l", P.lAnkle], ["r", P.rAnkle]]) {
    const fall = footFall(i);
    if (fall > TUNING.stepSpeed) tr.falling[side] = true;
    else if (tr.falling[side] && fall < TUNING.stepSpeed * 0.3) { tr.falling[side] = false; steps++; }
  }

  tr.prev = lm.map((p) => ({ ...p }));
  tr.prevT = t;

  const bpm = trackBounce(tr, hips.y / torso, t);
  const jumped = trackJump(tr, lm, torso, t);
  const armsUp = [P.lWrist, P.rWrist].every((i) => seen(lm[i]) && lm[i].y < lm[P.nose].y);

  // Freeze: standing still for a moment.
  if (tr.energy < TUNING.stillBelow) tr.stillSince ??= t;
  else tr.stillSince = null;
  const frozen = tr.stillSince !== null && t - tr.stillSince > TUNING.freezeMs;

  const reading = { visible: true, energy: tr.energy, bpm, jumped, armsUp, hands, steps, frozen };
  reading.style = chooseStyle(tr, reading, t);
  return reading;
}

// Picks Flow, Hip hop, House or Rave. Switches only after the new style has lasted holdMs,
// so one quick move doesn't flip the music back and forth.
function chooseStyle(tr, r, t) {
  tr.jumps = tr.jumps.filter((j) => t - j < 4000);
  let want = tr.style;
  if (tr.energy >= TUNING.raveAt || tr.jumps.length >= 2) want = "rave";
  else if (r.bpm) want = foldTempo(r.bpm) >= TUNING.houseFrom ? "house" : "hiphop";
  else if (tr.energy < TUNING.flowBelow) want = "flow";
  if (want !== tr.wantStyle) { tr.wantStyle = want; tr.wantSince = t; }
  if (want !== tr.style && t - tr.wantSince >= TUNING.holdMs) tr.style = want;
  return tr.style;
}

// Dancers often bounce on every other beat, so 60 bounces a minute can mean 120 BPM music.
export function foldTempo(bpm) {
  while (bpm < 78) bpm *= 2;
  while (bpm > 140) bpm /= 2;
  return Math.round(bpm);
}

// Bounce rate: count each time the hips reach a low point and turn back up.
// Returns bounces per minute, or null when there's no steady bounce.
function trackBounce(tr, y, t) {
  if (tr.ext === null) tr.ext = y;
  if (tr.dir > 0) {                         // hips going down (y grows)
    if (y > tr.ext) tr.ext = y;
    else if (tr.ext - y > TUNING.bounceDepth) { tr.bottoms.push(t); tr.dir = -1; tr.ext = y; }
  } else {                                  // hips going up
    if (y < tr.ext) tr.ext = y;
    else if (y - tr.ext > TUNING.bounceDepth) { tr.dir = 1; tr.ext = y; }
  }
  tr.bottoms = tr.bottoms.filter((b) => t - b < 4000);
  if (tr.bottoms.length < 3 || t - tr.bottoms.at(-1) > 1500) return null;
  const gaps = tr.bottoms.slice(1).map((b, i) => b - tr.bottoms[i]).sort((a, b) => a - b);
  const bpm = 60000 / gaps[Math.floor(gaps.length / 2)];
  return bpm >= 40 && bpm <= 220 ? Math.round(bpm) : null;
}

// Jump: both ankles well above where they usually rest (the floor). Counts once per jump.
function trackJump(tr, lm, torso, t) {
  const l = lm[P.lAnkle], r = lm[P.rAnkle];
  if (!seen(l) || !seen(r)) return false;
  tr.ankles.push({ t, y: Math.max(l.y, r.y) });
  tr.ankles = tr.ankles.filter((a) => t - a.t < 3000);
  const floor = Math.max(...tr.ankles.map((a) => a.y));
  const lift = TUNING.jumpHeight * torso;
  const up = floor - l.y > lift && floor - r.y > lift;
  const jumped = up && tr.jumpReady;
  if (jumped) tr.jumps.push(t);
  tr.jumpReady = !up; // ready again once both feet are back down
  return jumped;
}

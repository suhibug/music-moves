// Turns body points from the camera into movement readings for the music.
// Pure math, no camera, page or sound code, so it is easy to test and tune.
// Tuned in Nov 2026 on 22 dance clips (hip hop, house, amapiano, Afro-Brazilian).

// MediaPipe Pose gives 33 points. These are the ones used here.
export const P = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
};
const USED = Object.values(P);
const LIMBS = [P.lElbow, P.rElbow, P.lWrist, P.rWrist, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle];

// Distances are in "torso lengths" (shoulders to hips), so they work at any distance from the camera.
export const TUNING = {
  steady: 0.5,        // smooths out camera jitter in the body points (0 to 1, lower is smoother)
  fullSpeed: 5,       // torso lengths per second that counts as 100% energy (dancers sit around 1.5 to 2.5)
  energyEase: 0.05,   // how quickly energy follows you (lower is calmer)
  handTimes: 4,       // a hand move counts when it's this many times faster than your usual hand speed
  handMin: 4,         // ...and at least this fast
  hitTimes: 2.5,      // a "hit": a burst this many times faster than your usual speed...
  hitStop: 0.4,       // ...that drops to under 40% of the burst...
  hitWindow: 250,     // ...within this many milliseconds (catching an accent in the music)
  stepSpeed: 3.5,     // foot coming down this fast, then stopping, is a step or stomp
  jumpSpeed: 3,       // both feet shooting up this fast (and the hips with them) is a jump
  wideAt: 2.6,        // arms and legs stretched this wide (wrist gap + ankle gap) is an extension
  lowAt: 0.85,        // hips this close to the ankles is going low
  stillBelow: 0.03,   // energy under this counts as standing still
  freezeMs: 1500,     // standing still this long fades the music down
  memory: 90,         // frames of "your usual speed" to compare against (about 3 seconds)
  minSeen: 0.5,       // how sure the camera must be that a point is really there
};

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seen = (p) => p && (p.visibility ?? 1) >= TUNING.minSeen;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const median = (list) => { const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
const remember = (list, v) => { list.push(v); if (list.length > TUNING.memory) list.shift(); };

export function createTracker() {
  return {
    pts: null, prev: null, prevT: 0, energy: 0, speed: 0,
    handSpeeds: { l: [], r: [] }, handFast: { l: false, r: false },
    bodySpeeds: [], peak: 0, peakT: 0, armed: false,
    falling: { l: false, r: false },
    lastJump: 0,
    wide: false, low: false, stillSince: null,
  };
}

// Reading when nobody is in view: let the energy fade and keep the music going.
export function away(tr) {
  tr.prev = null;
  tr.pts = null;
  tr.energy *= 0.97;
  return blank(tr.energy);
}
const blank = (energy) => ({ visible: false, energy, hands: [], steps: 0, hit: false, jumped: false, armsUp: false, extended: false, wentLow: false, level: 1, span: 0, frozen: false, points: [] });

// lm: one person's 33 points (x, y from 0 to 1, y grows downward). t: milliseconds.
// aspect: video width / height, so sideways and up-down distances are measured the same way.
export function update(tr, lm, t, aspect = 1) {
  // Smooth the points a little so camera jitter doesn't sound like movement.
  const raw = {};
  for (const i of USED) raw[i] = { x: lm[i].x * aspect, y: lm[i].y, visibility: lm[i].visibility ?? 1 };
  if (!tr.pts) tr.pts = raw;
  else for (const i of USED) {
    tr.pts[i].x += (raw[i].x - tr.pts[i].x) * TUNING.steady;
    tr.pts[i].y += (raw[i].y - tr.pts[i].y) * TUNING.steady;
    tr.pts[i].visibility = raw[i].visibility;
  }
  const c = tr.pts;
  if (![P.lShoulder, P.rShoulder, P.lHip, P.rHip].every((i) => seen(c[i]))) return away(tr);

  const shoulders = mid(c[P.lShoulder], c[P.rShoulder]), hips = mid(c[P.lHip], c[P.rHip]);
  const torso = Math.max(dist(shoulders, hips), 0.01);
  const dt = tr.prev ? (t - tr.prevT) / 1000 : 0;
  const fresh = dt > 0 && dt < 0.2;
  const r = blank(tr.energy);
  r.visible = true;
  r.points = [P.lWrist, P.rWrist, P.lAnkle, P.rAnkle].filter((i) => seen(c[i])).map((i) => ({ x: c[i].x / aspect, y: c[i].y, hand: i === P.lWrist || i === P.rWrist }));

  if (fresh) {
    const p = tr.prev;
    const both = (i) => seen(c[i]) && seen(p.c[i]);

    // Energy: how fast your arms and legs move, eased so the music grows and fades smoothly.
    const moved = LIMBS.filter(both);
    const speed = moved.length ? moved.reduce((s, i) => s + dist(c[i], p.c[i]), 0) / moved.length / torso / dt : 0;
    tr.energy += (clamp01(speed / TUNING.fullSpeed) - tr.energy) * TUNING.energyEase;
    r.energy = tr.energy;

    // Hands: a wrist moving much faster than your own usual hand speed plays a note.
    // Measured against the shoulders, so a whole-body move doesn't count. Higher hand = higher note.
    for (const [side, i] of [["l", P.lWrist], ["r", P.rWrist]]) {
      if (!both(i)) continue;
      const s = Math.hypot((c[i].x - shoulders.x) - (p.c[i].x - p.shoulders.x), (c[i].y - shoulders.y) - (p.c[i].y - p.shoulders.y)) / torso / dt;
      const usual = median(tr.handSpeeds[side]);
      remember(tr.handSpeeds[side], s);
      const fast = s > Math.max(TUNING.handMin, TUNING.handTimes * usual);
      if (fast && !tr.handFast[side]) r.hands.push(clamp01((hips.y - c[i].y) / (2.2 * torso)));
      tr.handFast[side] = fast;
    }

    // Hit: a sudden burst, then a sharp stop. This is "catching" an accent.
    const usual = median(tr.bodySpeeds);
    remember(tr.bodySpeeds, speed);
    if (speed > TUNING.hitTimes * usual && speed > 2 && speed > tr.peak) { tr.peak = speed; tr.peakT = t; tr.armed = true; }
    if (tr.armed && t - tr.peakT >= TUNING.hitWindow) { tr.armed = false; tr.peak = 0; }
    else if (tr.armed && speed < TUNING.hitStop * tr.peak) { r.hit = true; tr.armed = false; tr.peak = 0; }

    // Jump: both feet and the hips shooting upward together. Measured by speed, not height,
    // so walking toward or away from the camera (which moves the feet on screen) isn't a jump.
    const rise = (i) => (both(i) ? (p.c[i].y - c[i].y) / torso / dt : 0);
    const hipRise = (p.hips.y - hips.y) / torso / dt;
    if (rise(P.lAnkle) > TUNING.jumpSpeed && rise(P.rAnkle) > TUNING.jumpSpeed && hipRise > TUNING.jumpSpeed / 2 && t - tr.lastJump > 600) {
      r.jumped = true;
      tr.lastJump = t;
    }

    // Steps: a foot moving down fast (compared with the hips), then stopping.
    for (const [side, i] of [["l", P.lAnkle], ["r", P.rAnkle]]) {
      if (!both(i)) continue;
      const fall = ((c[i].y - hips.y) - (p.c[i].y - p.hips.y)) / torso / dt;
      if (fall > TUNING.stepSpeed) tr.falling[side] = true;
      else if (tr.falling[side] && fall < 1) { tr.falling[side] = false; r.steps++; }
    }
  }
  tr.prev = { c: structuredClone(c), shoulders, hips };
  tr.prevT = t;

  const la = c[P.lAnkle], ra = c[P.rAnkle];
  if (seen(la) && seen(ra)) {
    // Level: 1 standing tall, 0 down low. Extension: arms and legs stretched wide.
    const level = ((la.y + ra.y) / 2 - hips.y) / torso;
    r.level = clamp01((level - 0.5) / 0.8);
    if (level < TUNING.lowAt && !tr.low) r.wentLow = true;
    tr.low = level < TUNING.lowAt + 0.15;
  }
  if (seen(c[P.lWrist]) && seen(c[P.rWrist]) && seen(la) && seen(ra)) {
    const span = (dist(c[P.lWrist], c[P.rWrist]) + dist(la, ra)) / torso;
    r.span = clamp01(span / 3.5);
    if (span > TUNING.wideAt && !tr.wide) r.extended = true;
    tr.wide = span > TUNING.wideAt - 0.3;
  }
  r.armsUp = [P.lWrist, P.rWrist].every((i) => seen(c[i]) && c[i].y < c[P.nose].y);

  // Freeze: standing still for a moment.
  if (tr.energy < TUNING.stillBelow) tr.stillSince ??= t;
  else tr.stillSince = null;
  r.frozen = tr.stillSince !== null && t - tr.stillSince > TUNING.freezeMs;
  return r;
}

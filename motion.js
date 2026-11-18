// Turns body points from the camera into movement readings: energy, bounce rate, jumps, arms up.
// Pure math, no camera or page code, so it is easy to test and tune.

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
  smoothing: 0.15,    // 0 to 1: higher reacts faster, lower is steadier
  grooveAt: 0.2,      // energy where Calm turns into Groove
  raveAt: 0.6,        // energy where Groove turns into Rave
  bounceDepth: 0.05,  // how far the hips must dip to count as one bounce
  jumpHeight: 0.25,   // how far both ankles must lift off the floor to count as a jump
  minSeen: 0.5,       // how sure the camera must be that a point is really there
};

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seen = (p) => (p.visibility ?? 1) >= TUNING.minSeen;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createTracker() {
  return {
    prev: null, prevT: 0, energy: 0,
    dir: 1, ext: null, bottoms: [], // bounce detection
    ankles: [],                     // recent ankle heights, to find the floor
  };
}

// lm: one person's 33 points (x, y from 0 to 1, y grows downward). t: time in milliseconds.
export function update(tr, lm, t) {
  const torsoSeen = [P.lShoulder, P.rShoulder, P.lHip, P.rHip].every((i) => seen(lm[i]));
  if (!torsoSeen) {
    tr.prev = null;
    tr.energy *= 0.9;
    return { visible: false, energy: tr.energy, mode: "away", bpm: null, jumping: false, armsUp: false };
  }
  const shoulders = mid(lm[P.lShoulder], lm[P.rShoulder]);
  const hips = mid(lm[P.lHip], lm[P.rHip]);
  const torso = Math.max(dist(shoulders, hips), 0.01);

  // Energy: how fast the body is moving, smoothed so it doesn't flicker.
  if (tr.prev) {
    const dt = (t - tr.prevT) / 1000;
    if (dt > 0 && dt < 0.5) {
      const moved = MOVERS.filter((i) => seen(lm[i]) && seen(tr.prev[i]));
      const speed = moved.length
        ? moved.reduce((s, i) => s + dist(lm[i], tr.prev[i]), 0) / moved.length / torso / dt
        : 0;
      const target = clamp01(speed / TUNING.fullSpeed);
      tr.energy += (target - tr.energy) * TUNING.smoothing;
    }
  }
  tr.prev = lm.map((p) => ({ ...p }));
  tr.prevT = t;

  const bpm = trackBounce(tr, hips.y / torso, t);
  const jumping = trackJump(tr, lm, torso, t);
  const armsUp = [P.lWrist, P.rWrist].some((i) => seen(lm[i]) && lm[i].y < lm[P.nose].y);

  let mode = "calm";
  if (jumping || tr.energy >= TUNING.raveAt) mode = "rave";
  else if (tr.energy >= TUNING.grooveAt) mode = "groove";

  return { visible: true, energy: tr.energy, mode, bpm, jumping, armsUp };
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
  return bpm >= 50 && bpm <= 200 ? Math.round(bpm) : null;
}

// Jump: both ankles well above where they usually rest (the floor) at the same time.
function trackJump(tr, lm, torso, t) {
  const l = lm[P.lAnkle], r = lm[P.rAnkle];
  if (!seen(l) || !seen(r)) return false;
  tr.ankles.push({ t, y: Math.max(l.y, r.y) });
  tr.ankles = tr.ankles.filter((a) => t - a.t < 3000);
  const floor = Math.max(...tr.ankles.map((a) => a.y));
  const lift = TUNING.jumpHeight * torso;
  return floor - l.y > lift && floor - r.y > lift;
}

// Every sound comes from what you do with the objects. Nothing plays until you touch something.
// Made live with Tone.js (free, open source): no recordings, nothing copyrighted.
//
//   grab / let go   a note in the object's material (higher on screen = higher note)
//   move it        notes as you wave it around       throw    a whoosh
//   catch          a bright accent                   bat      a hit
//   bounce         a knock (floor low, ceiling high) smash    a crunch and falling notes
//   stretch        a held chord that opens up as you pull and closes as you squeeze
// Keep playing and a soft beat grows underneath. Stop, and it fades back to silence.

let T, s, step = 0, activity = 0, groove = 0, stretching = false;
const lastAt = new Map();

// D minor pentatonic: any two notes sound good together.
const NOTES = ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4", "C5", "D5", "F5", "G5", "A5", "C6"];
// Each material plays in its own range of those notes.
const RANGE = { glass: [7, 14], metal: [5, 12], soft: [4, 11], bounce: [3, 10], wood: [0, 7], stone: [0, 6] };
// How much each action builds up the beat underneath.
const WEIGHT = { grab: 1, move: 0.4, throw: 2, catch: 3, bat: 2, bounce: 0.8, shatter: 3, crush: 3, stretchStart: 1 };

export async function start() {
  T = window.Tone;
  await T.start();
  if (!s) build();
  T.Transport.bpm.value = 100;
  T.Transport.start("+0.1");
}
export function stop() {
  if (!T) return;
  T.Transport.stop();
  stretch(null);
}
export const setVolume = (db) => s && s.master.volume.rampTo(db, 0.1);
export const beatLevel = () => groove;

function build() {
  const master = new T.Volume(-6).toDestination();
  const space = new T.Reverb({ decay: 3.5, wet: 0.3 }).connect(master);
  const crush = new T.BitCrusher(4).connect(space);
  const padTone = new T.Filter(400, "lowpass").connect(space);
  const air = new T.Filter(800, "bandpass", -12).connect(space);
  s = {
    master, padTone, air,
    glass: new T.PolySynth(T.FMSynth, { harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.4 }, volume: -12 }).connect(space),
    metal: new T.PolySynth(T.FMSynth, { harmonicity: 5.1, modulationIndex: 18, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }, volume: -18 }).connect(space),
    soft: new T.PolySynth(T.FMSynth, { harmonicity: 8, modulationIndex: 2, envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.6 }, volume: -10 }).connect(space),
    bounce: new T.PolySynth(T.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 }, volume: -8 }).connect(space),
    wood: new T.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -6 }).connect(space),
    stone: new T.MembraneSynth({ pitchDecay: 0.02, octaves: 2.5, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -6 }).connect(space),
    knock: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -22 }).connect(space),
    whoosh: new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.05, decay: 0.4, sustain: 0 }, volume: -10 }).connect(air),
    crunch: new T.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -6 }).connect(crush),
    pad: new T.PolySynth(T.AMSynth, { harmonicity: 1.5, envelope: { attack: 0.4, decay: 0.3, sustain: 0.9, release: 1.5 }, volume: -10 }).connect(padTone),
    kick: new T.MembraneSynth({ pitchDecay: 0.05, octaves: 6, volume: -8 }).connect(master),
    hat: new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.04, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5, volume: -34 }).connect(master),
    bass: new T.MonoSynth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 }, volume: -12 }).connect(master),
  };
  T.Transport.scheduleRepeat(tick, "16n");
}

// The beat underneath: only there while you keep playing.
function tick(time) {
  const i = step % 16;
  if (i === 0) {
    activity = Math.min(activity, 10);
    groove = activity > 6 ? 2 : activity > 2.5 ? 1 : 0;
    activity *= 0.4; // fades within a few seconds if you stop
  }
  if (groove >= 1) {
    if (i === 0) play(s.kick, "D1", time, "8n", 0.7);
    if (i % 4 === 2) play(s.hat, 300, time, "32n", 0.6);
  }
  if (groove >= 2) {
    if (i === 8 || i === 11) play(s.kick, "D1", time, "8n", 0.6);
    if (i % 2 === 1) play(s.hat, 300, time, "32n", 0.25);
    if (i === 0 || i === 10) play(s.bass, step % 64 < 32 ? "D2" : "A1", time, "8n", 0.8);
  }
  step++;
}

// A one-voice instrument can't play twice at the exact same moment, so the second one is nudged 2 ms.
function safe(inst, time) {
  const prev = lastAt.get(inst) ?? -1;
  const at = time >= prev + 0.002 ? time : prev + 0.002;
  lastAt.set(inst, at);
  return at;
}
function play(inst, note, time, dur = "8n", vel = 1) {
  if (inst instanceof T.NoiseSynth) inst.triggerAttackRelease(dur, safe(inst, time), vel);
  else inst.triggerAttackRelease(note, dur, inst instanceof T.PolySynth ? time : safe(inst, time), vel);
}

function noteFor(material, height, shift = 0) {
  const [lo, hi] = RANGE[material];
  const k = Math.round(lo + Math.min(1, Math.max(0, height)) * (hi - lo)) + shift;
  return NOTES[Math.min(NOTES.length - 1, Math.max(0, k))];
}

// Turns one event from world.js into sound, on the beat grid so it stays musical.
export function play1(e) {
  if (!s || T.Transport.state !== "started") return;
  activity += WEIGHT[e.type] || 0;
  const inst = s[e.material];
  const at = T.Transport.nextSubdivision(e.type === "move" ? "8n" : "16n");
  const tap = (shift = 0, vel = 0.8, dur = "8n") => {
    play(inst, noteFor(e.material, e.height, shift), at, dur, vel);
    if (e.material === "wood" || e.material === "stone") play(s.knock, null, at, "32n", vel);
  };
  switch (e.type) {
    case "grab": tap(0, 0.6); break;
    case "release": tap(-2, 0.35); break;
    case "move": tap(0, 0.5, "16n"); break;
    case "appear": play(s.glass, "D6", at, "16n", 0.15); break;
    case "bat": tap(1, Math.min(1, 0.4 + e.speed / 4)); break;
    case "bounce": tap(e.where === "floor" ? -3 : e.where === "ceiling" ? 3 : 0, Math.min(1, 0.3 + e.speed / 3), "16n"); break;
    case "throw":
      s.air.frequency.cancelScheduledValues(T.now());
      s.air.frequency.setValueAtTime(400, at);
      s.air.frequency.exponentialRampToValueAtTime(400 + e.speed * 1500, at + 0.4);
      play(s.whoosh, null, at, "8n", Math.min(1, 0.4 + e.speed / 3));
      tap(2, 0.5);
      break;
    case "catch": {
      tap(0, 0.9);
      play(s.glass, noteFor("glass", e.height, 2), at, "4n", 0.5);
      break;
    }
    case "shatter":
    case "crush": {
      play(s.crunch, null, at, "8n", 1);
      const step32 = T.Time("32n").toSeconds();
      [3, 1, -1, -3].forEach((sh, k) => play(inst, noteFor(e.material, e.height, sh), at + k * step32, "16n", 0.6 - k * 0.1));
      break;
    }
    case "stretchStart": stretch(1); break;
    case "stretchEnd": stretch(null); break;
    case "stretch": stretch(e.amount); break;
  }
}

// Two hands on one object holds a chord. Pull apart: brighter and louder. Squeeze: darker and quieter.
export function stretch(amount) {
  if (!s) return;
  if (amount === null) {
    if (stretching) s.pad.releaseAll();
    stretching = false;
    return;
  }
  if (!stretching) { s.pad.triggerAttack(["D3", "A3", "C4", "F4"], T.now(), 0.5); stretching = true; }
  s.padTone.frequency.rampTo(200 + amount * amount * 1400, 0.1);
}

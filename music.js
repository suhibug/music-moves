// Live music that your movement plays. Every sound is made here with Tone.js (free and
// open source): no recordings, so nothing is copyrighted and nothing costs money.
// Tone.js is loaded by a <script> tag in index.html as window.Tone.
//
// How movement becomes music:
//   how much you move  -> layers come in (bed, then percussion and bass, then drums, then top layer)
//   a sharp hit        -> an accent        hands      -> melody notes (higher hand, higher note)
//   steps              -> percussion       stretching -> a long swell
//   going low          -> darker sound and a deep drop   jump -> crash   arms up -> rising whoosh
//   freeze             -> music fades to a hum until you move again
// Everything lands on the beat grid, so it always stays in time.

let T, s;
let vibe = "amapiano", nextVibe = null, step = 0, layer = 0, energy = 0;
let lastHand = -1, lastHit = -1, lastStep = -1, riserOn = false, frozen = false, lastCutoff = 0, lastWet = 0;

// ---------- Sound worlds ----------
// Each one is inspired by a style of music (not by any song), with its own tempo, chords and scale.
export const VIBES = {
  amapiano: {
    name: "Amapiano", about: "Log drums, shakers, jazzy keys", bpm: 112, swing: 0.15,
    chords: [["F3", "Ab3", "C4", "Eb4", "G4"], ["Db3", "F3", "Ab3", "C4"], ["Bb2", "Db3", "F3", "Ab3", "C4"], ["C3", "E3", "G3", "Bb3"]],
    roots: ["F1", "Db1", "Bb0", "C1"],
    scale: ["F4", "Ab4", "Bb4", "C5", "Eb5", "F5", "Ab5", "Bb5", "C6"],
  },
  house: {
    name: "House", about: "Four on the floor, deep chords", bpm: 124, swing: 0,
    chords: [["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["D3", "F3", "A3", "C4"], ["E3", "G3", "B3", "D4"]],
    roots: ["A1", "F1", "D1", "E1"],
    scale: ["A4", "C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"],
  },
  afro: {
    name: "Afro-Brazil", about: "Tamborim, surdo, warm swells", bpm: 128, swing: 0.1,
    chords: [["D3", "F#3", "A3", "C#4"], ["B2", "D3", "F#3", "A3"], ["G2", "B2", "D3", "F#3"], ["A2", "C#3", "E3", "G3"]],
    roots: ["D1", "B0", "G1", "A1"],
    scale: ["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"],
  },
  hiphop: {
    name: "Hip hop", about: "Hard drums, 808s, attitude", bpm: 92, swing: 0.3,
    chords: [["C3", "Eb3", "G3", "Bb3"], ["Ab2", "C3", "Eb3", "G3"], ["F2", "Ab2", "C3", "Eb3"], ["G2", "Bb2", "D3", "F3"]],
    roots: ["C1", "Ab0", "F1", "G1"],
    scale: ["C4", "Eb4", "F4", "G4", "Bb4", "C5", "Eb5", "F5", "G5"],
  },
  calm: {
    name: "Calm", about: "Soft pads and bells, like plant music", bpm: 72, swing: 0,
    chords: [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C3", "E3", "G3", "C4"], ["G3", "B3", "D4"]],
    roots: ["A1", "F1", "C2", "G1"],
    scale: ["A4", "C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"],
  },
};

// ---------- Start and stop ----------
// Must run from a click or tap: browsers only allow sound after the person touches the page.
export async function start(name) {
  T = window.Tone;
  await T.start();
  if (!s) build();
  vibe = name;
  nextVibe = null;
  layer = 0;
  applyVibe();
  T.Transport.start("+0.1");
}

export function stop() {
  if (!T) return;
  T.Transport.stop();
  riser(false);
}

export const setVibe = (name) => { if (name !== vibe) nextVibe = name; };
export const setVolume = (db) => s && s.master.volume.rampTo(db, 0.1);
export const current = () => ({ key: nextVibe || vibe, ...VIBES[nextVibe || vibe], layer });

function applyVibe() {
  T.Transport.bpm.rampTo(VIBES[vibe].bpm, 0.5);
  T.Transport.swing = VIBES[vibe].swing;
}

// ---------- Instruments ----------
function build() {
  const out = new T.Filter(16000, "lowpass").toDestination(); // follows your body height, closes when you freeze
  const master = new T.Volume(-8).connect(out);
  const space = new T.Reverb({ decay: 4, wet: 0.3 }).connect(master);
  const dry = new T.Volume(0).connect(master);
  const drive = new T.Distortion(0.35).connect(dry);
  const shakerTone = new T.Filter(7000, "highpass").connect(dry);
  const clapTone = new T.Filter(1600, "bandpass").connect(space);
  T.Transport.swingSubdivision = "16n";

  s = {
    out, master, space,
    keys: new T.PolySynth(T.FMSynth, { harmonicity: 3, modulationIndex: 1.5, envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 0.8 }, volume: -18 }).connect(space),
    pad: new T.PolySynth(T.AMSynth, { harmonicity: 1.5, envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 3 }, volume: -20 }).connect(space),
    swell: new T.PolySynth(T.AMSynth, { harmonicity: 2, envelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.5 }, volume: -16 }).connect(space),
    bell: new T.PolySynth(T.FMSynth, { harmonicity: 3.01, modulationIndex: 6, envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 1.4 }, volume: -14 }).connect(space),
    kalimba: new T.PolySynth(T.FMSynth, { harmonicity: 8, modulationIndex: 2, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.5 }, volume: -12 }).connect(space),
    flute: new T.PolySynth(T.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.06, decay: 0.3, sustain: 0.4, release: 0.6 }, volume: -12 }).connect(space),
    pluck: new T.PolySynth(T.Synth, { oscillator: { type: "square8" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.2 }, volume: -22 }).connect(space),
    stab: new T.PolySynth(T.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, volume: -22 }).connect(space),
    // The amapiano log drum: a deep, round note that slides.
    logdrum: new T.MonoSynth({ oscillator: { type: "sine" }, portamento: 0.04, envelope: { attack: 0.005, decay: 0.35, sustain: 0.1, release: 0.2 }, filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.3, baseFrequency: 200, octaves: 3 }, volume: -4 }).connect(dry),
    sub: new T.MonoSynth({ oscillator: { type: "sine" }, portamento: 0.06, envelope: { attack: 0.005, decay: 0.8, sustain: 0.4, release: 0.4 }, volume: -6 }).connect(drive),
    bass: new T.MonoSynth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.2 }, volume: -8 }).connect(dry),
    kick: new T.MembraneSynth({ pitchDecay: 0.05, octaves: 6, volume: -4 }).connect(dry),
    conga: new T.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -12 }).connect(space),
    snare: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -14 }).connect(dry),
    clap: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0 }, volume: -8 }).connect(clapTone),
    shaker: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.004, decay: 0.05, sustain: 0 }, volume: -24 }).connect(shakerTone),
    hat: new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5, volume: -32 }).connect(dry),
    openHat: new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.25, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5, volume: -34 }).connect(dry),
    crash: new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 1.4, sustain: 0 }, volume: -16 }).connect(space),
    riserFilter: new T.Filter(300, "bandpass", -12).connect(space),
  };
  s.riser = new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 1, decay: 0, sustain: 1, release: 0.6 }, volume: -20 }).connect(s.riserFilter);
  T.Transport.scheduleRepeat(tick, "16n");
}

// ---------- The beat ----------
// Runs every 16th note (16 per bar). Layers and sound worlds only change on the first beat of a bar,
// like a DJ mix, so the music never jumps around mid-phrase.
function tick(time) {
  const i = step % 16, bar = Math.floor(step / 16);
  if (i === 0) {
    if (nextVibe) { vibe = nextVibe; nextVibe = null; applyVibe(); }
    layer = layerFor(energy, layer);
  }
  const v = VIBES[vibe], at = Math.floor(bar / 2) % 4;
  PATTERNS[vibe](i, time, layer, v.chords[at], v.roots[at], bar);
  step++;
}

// 0 = just the bed, 1 = percussion and bass, 2 = full drums, 3 = everything.
// Going up needs a bit more energy than staying, so it doesn't flip back and forth.
const STEPS = [0.1, 0.28, 0.5];
function layerFor(e, now) {
  let next = STEPS.filter((x) => e >= x).length;
  if (next < now && e > STEPS[now - 1] - 0.05) next = now;
  return next;
}

// A one-voice drum can't be played twice at the exact same moment (the beat and a dance move
// sometimes land together), so a second hit is nudged 2 milliseconds later.
const lastAt = new Map();
function safe(inst, time) {
  const prev = lastAt.get(inst) ?? -1;
  const at = time >= prev + 0.002 ? time : prev + 0.002;
  lastAt.set(inst, at);
  return at;
}
const hit = (inst, note, time, dur = "16n", vel = 1) => inst.triggerAttackRelease(note, dur, safe(inst, time), vel);
const noise = (inst, time, dur = "16n", vel = 1) => inst.triggerAttackRelease(dur, safe(inst, time), vel);
const up = (n, semis) => T.Frequency(n).transpose(semis).toNote();

const PATTERNS = {
  amapiano(i, time, L, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.4);
    if (L >= 1) {
      noise(s.shaker, time, "32n", i % 4 === 2 ? 1 : 0.45);
      if ([3, 7, 10, 14].includes(i)) hit(s.logdrum, i === 10 ? up(root, 19) : up(root, 12), time, "8n");
    }
    if (L >= 2) {
      if (i === 0 || i === 8) hit(s.kick, "C1", time, "8n", 0.8);
      if (i === 4 || i === 12) noise(s.clap, time);
      if ([0, 6, 10].includes(i)) s.keys.triggerAttackRelease(chord, "16n", time, 0.5);
    }
    if (L >= 3 && [2, 5, 11, 13].includes(i)) hit(s.conga, i % 2 ? "G3" : "D4", time, "16n", 0.6);
  },
  house(i, time, L, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.45);
    if (L >= 1 && i % 4 === 2) { hit(s.openHat, 300, time, "16n"); hit(s.bass, up(root, 12), time); }
    if (L >= 2) {
      if (i % 4 === 0) hit(s.kick, "C1", time, "8n");
      if (i === 4 || i === 12) noise(s.clap, time, "16n", 0.9);
      if (i % 2 === 1) hit(s.hat, 300, time, "32n", 0.4);
    }
    if (L >= 3 && (i === 3 || i === 6 || i === 14)) s.stab.triggerAttackRelease(chord.map((n) => up(n, 12)), "16n", time, 0.5);
  },
  afro(i, time, L, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.5);
    if (L >= 1 && [0, 2, 3, 5, 6, 8, 10, 11, 13, 14].includes(i)) hit(s.conga, "A4", time, "32n", i % 4 === 0 ? 0.7 : 0.35); // tamborim
    if (L >= 1 && (i === 0 || i === 8)) hit(s.bass, root, time, "8n");
    if (L >= 2) {
      if ([0, 3, 8, 10].includes(i)) hit(s.kick, "D1", time, "8n", 0.9);   // tamborzão-style kick
      if (i === 4 || i === 12) noise(s.snare, time);
    }
    if (L >= 3) {
      if (i === 7 || i === 15) hit(s.conga, "D2", time, "8n", 0.9);       // surdo
      if (i % 2 === 0) noise(s.shaker, time, "32n", 0.6);
    }
  },
  hiphop(i, time, L, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.35);
    if (L >= 1) {
      if (i % 2 === 0) hit(s.hat, 250, time, "32n", i % 4 === 0 ? 0.9 : 0.5);
      if (i === 0 || i === 10) hit(s.sub, root, time, "4n");
    }
    if (L >= 2) {
      if ([0, 7, 10].includes(i)) hit(s.kick, "C1", time, "8n");
      if (i === 4 || i === 12) { noise(s.snare, time, "16n"); noise(s.clap, time, "16n", 0.6); }
    }
    if (L >= 3 && i >= 13) { // hi-hat rolls
      hit(s.hat, 250, time, "64n", 0.7);
      hit(s.hat, 250, time + T.Time("32n").toSeconds(), "64n", 0.5);
    }
  },
  calm(i, time, L, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.6);
    if (i % 4 === 0 && Math.random() < 0.15 + 0.1 * L) hit(s.bell, pick(VIBES.calm.scale), time, "2n", 0.3);
    if (L >= 1 && i === 0) hit(s.bass, root, time, "2n", 0.6);
    if (L >= 2 && i % 4 === 2) noise(s.shaker, time, "32n", 0.4);
    if (L >= 3 && i % 2 === 0) hit(s.kalimba, VIBES.calm.scale[(i / 2 + bar) % 5], time, "8n", 0.35);
  },
};

// What a hand note, a hit, a step, a stretch and a drop sound like in each world.
const VOICES = {
  amapiano: { hand: () => s.kalimba, hit: (t, root) => { hit(s.logdrum, up(root, 24), t, "8n"); noise(s.clap, t); }, step: (t) => hit(s.conga, "G3", t, "16n", 0.5) },
  house:    { hand: () => s.keys, hit: (t, root, chord) => s.stab.triggerAttackRelease(chord.map((n) => up(n, 12)), "16n", t, 0.8), step: (t) => hit(s.hat, 300, t, "32n", 0.7) },
  afro:     { hand: () => s.flute, hit: (t) => { hit(s.conga, "D2", t, "8n"); noise(s.snare, t, "16n", 0.6); }, step: (t) => hit(s.conga, "A4", t, "32n", 0.6) },
  hiphop:   { hand: () => s.pluck, hit: (t, root) => { noise(s.snare, t); noise(s.clap, t); hit(s.sub, up(root, 7), t, "8n"); }, step: (t) => hit(s.kick, "C1", t, "16n", 0.5) },
  calm:     { hand: () => s.bell, hit: (t) => hit(s.bell, "A6", t, "4n", 0.4), step: (t) => hit(s.kalimba, "A3", t, "8n", 0.4) },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const nextSlot = (sub) => T.Transport.nextSubdivision(sub);

// Called many times a second with the latest reading from motion.js.
export function follow(r) {
  if (!s || T.Transport.state !== "started") return;
  energy = r.energy;
  const v = VIBES[vibe], voice = VOICES[vibe], at = Math.floor(step / 32) % 4;

  // Hands: melody notes on the next 8th note, at most one per 8th. Higher hand, higher note.
  for (const height of r.hands) {
    const when = nextSlot("8n");
    if (when <= lastHand) break;
    lastHand = when;
    voice.hand().triggerAttackRelease(v.scale[Math.round(height * (v.scale.length - 1))], "8n", when, 0.7);
  }
  // Hits: an accent on the next 16th note, at most one per beat.
  if (r.hit) {
    const when = nextSlot("16n");
    if (when - lastHit > T.Time("4n").toSeconds() * 0.9) { lastHit = when; voice.hit(when, v.roots[at], v.chords[at]); }
  }
  // Steps: light percussion on the next 16th note.
  if (r.steps) {
    const when = nextSlot("16n");
    if (when > lastStep) { lastStep = when; voice.step(when); }
  }
  // Stretching wide: a long, warm swell of the current chord.
  if (r.extended) s.swell.triggerAttackRelease(v.chords[at].map((n) => up(n, 12)), "1m", nextSlot("8n"), 0.6);
  // Going low: a deep drop.
  if (r.wentLow) hit(s.sub, v.roots[at], nextSlot("8n"), "2n", 0.9);
  // Jump: a crash and a boom.
  if (r.jumped) { const when = nextSlot("16n"); noise(s.crash, when, "1n"); hit(s.kick, "A0", when, "4n"); }
  riser(r.armsUp);

  // Your height shapes the sound: stand tall for bright and open, go low for dark and deep.
  // Freeze, and it fades to a muffled hum until you move again. Stretching adds more echo.
  const cutoff = r.frozen ? 300 : 500 + Math.pow(r.visible ? r.level : 1, 1.6) * 15500;
  if (r.frozen !== frozen || Math.abs(cutoff - lastCutoff) > 400) {
    s.out.frequency.cancelScheduledValues(T.now());
    s.out.frequency.rampTo(cutoff, r.frozen !== frozen ? 1 : 0.25);
    lastCutoff = cutoff;
  }
  frozen = r.frozen;
  const wet = 0.2 + r.span * 0.35;
  if (r.visible && Math.abs(wet - lastWet) > 0.03) {
    s.space.wet.cancelScheduledValues(T.now());
    s.space.wet.rampTo(wet, 0.5);
    lastWet = wet;
  }
}

function riser(on) {
  if (!s || on === riserOn) return;
  riserOn = on;
  if (on) {
    s.riser.triggerAttack();
    s.riserFilter.frequency.value = 300;
    s.riserFilter.frequency.rampTo(6000, 4);
  } else {
    s.riser.triggerRelease();
    s.riserFilter.frequency.cancelScheduledValues(T.now());
  }
}

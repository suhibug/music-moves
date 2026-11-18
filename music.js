// Live music that follows the dancer. Every sound is made here with Tone.js (free and
// open source): no recordings, so nothing is copyrighted and nothing costs money.
// Tone.js is loaded by a <script> tag in index.html as window.Tone.

export const STYLES = {
  flow:   { name: "Flow",    bpm: 72,  min: 64,  max: 80 },  // calm, like plant music
  hiphop: { name: "Hip hop", bpm: 90,  min: 80,  max: 105 },
  house:  { name: "House",   bpm: 124, min: 115, max: 130 },
  rave:   { name: "Rave",    bpm: 128, min: 124, max: 140 },
};

// A minor pentatonic: five notes that always sound good together, so a hand move is never a wrong note.
const SCALE = ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"];
// Am, F, C, G: two bars each.
const CHORDS = [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C3", "E3", "G3", "C4"], ["G3", "B3", "D4"]];
const ROOTS = ["A1", "F1", "C2", "G1"];

let T, s; // Tone, and the instruments
let style = "flow", nextStyle = null, step = 0, lastNote = 0, riserOn = false, frozen = false;
let tempo = STYLES.flow.bpm; // where the tempo is heading

// Must run from a click or tap: browsers only allow sound after the person touches the page.
export async function start() {
  T = window.Tone;
  await T.start();
  if (!s) build();
  tempo = STYLES[style].bpm;
  T.Transport.bpm.value = tempo;
  T.Transport.start("+0.1");
}

export function stop() {
  if (!T) return;
  T.Transport.stop();
  riser(false);
}

export function setVolume(db) {
  if (s) s.master.volume.rampTo(db, 0.1);
}

function build() {
  const out = new T.Filter(18000, "lowpass").toDestination(); // closes down when you freeze
  const master = new T.Volume(-8).connect(out);
  const space = new T.Reverb({ decay: 5, wet: 0.35 }).connect(master);
  const drums = new T.Volume(0).connect(master);
  s = {
    out, master,
    pad: new T.PolySynth(T.AMSynth, {
      harmonicity: 1.5, envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 3 }, volume: -16,
    }).connect(space),
    bells: new T.PolySynth(T.FMSynth, {
      harmonicity: 3.01, modulationIndex: 6,
      envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 1.5 }, volume: -12,
    }).connect(space),
    kick: new T.MembraneSynth({ pitchDecay: 0.05, octaves: 6, volume: -4 }).connect(drums),
    snare: new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -16 }).connect(drums),
    hat: new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32,
      resonance: 6000, octaves: 1.5, volume: -30,
    }).connect(drums),
    bass: new T.MonoSynth({
      oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.2 }, volume: -8,
    }).connect(master),
    stab: new T.PolySynth(T.Synth, {
      oscillator: { type: "sawtooth" }, envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, volume: -20,
    }).connect(space),
    crash: new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 1.4, sustain: 0 }, volume: -14 }).connect(space),
    riserFilter: new T.Filter(300, "bandpass", -12).connect(space),
  };
  s.riser = new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 1, decay: 0, sustain: 1, release: 0.6 }, volume: -18 }).connect(s.riserFilter);
  T.Transport.swingSubdivision = "16n";
  T.Transport.scheduleRepeat(tick, "16n");
}

// Runs every 16th note. A bar has 16 of them.
function tick(time) {
  const i = step % 16, bar = Math.floor(step / 16);
  if (i === 0 && nextStyle) {               // styles change on the first beat of a bar, like a DJ mix
    style = nextStyle;
    nextStyle = null;
    slideTempo(STYLES[style].bpm, 1);
    T.Transport.swing = style === "hiphop" ? 0.35 : 0;
  }
  const chord = CHORDS[Math.floor(bar / 2) % 4], root = ROOTS[Math.floor(bar / 2) % 4];
  PATTERNS[style](i, time, chord, root, bar);
  step++;
}

const PATTERNS = {
  // Soft pads and slow bell notes that wander, like plant music.
  flow(i, time, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.6);
    if (i % 4 === 0 && Math.random() < 0.18) s.bells.triggerAttackRelease(pick(SCALE.slice(3)), "2n", time, 0.35);
  },
  // Boom bap: heavy kick, snare on 2 and 4, swung hi-hats, deep bass.
  hiphop(i, time, chord, root, bar) {
    if (i === 0 && bar % 2 === 0) s.pad.triggerAttackRelease(chord, "2m", time, 0.3);
    if ([0, 7, 10].includes(i)) s.kick.triggerAttackRelease("C1", "8n", time);
    if (i === 4 || i === 12) s.snare.triggerAttackRelease("16n", time);
    if (i % 2 === 0) s.hat.triggerAttackRelease(250, "32n", time, i % 4 === 0 ? 0.9 : 0.5);
    if (i === 0 || i === 10) s.bass.triggerAttackRelease(root, "4n", time);
  },
  // Four on the floor: a kick on every beat, off-beat hats and bass.
  house(i, time, chord, root) {
    if (i % 4 === 0) s.kick.triggerAttackRelease("C1", "8n", time);
    if (i === 4 || i === 12) s.snare.triggerAttackRelease("16n", time, 0.8);
    if (i % 4 === 2) { s.hat.triggerAttackRelease(250, "16n", time, 1); s.bass.triggerAttackRelease(T.Frequency(root).transpose(12), "16n", time); }
    else if (i % 2 === 1) s.hat.triggerAttackRelease(250, "32n", time, 0.3);
    if (i === 6 || i === 14) s.stab.triggerAttackRelease(chord, "16n", time, 0.4);
  },
  // House with more drive: busier hats, chord stabs, bass on every off-beat.
  rave(i, time, chord, root) {
    if (i % 4 === 0) s.kick.triggerAttackRelease("C1", "8n", time);
    if (i === 4 || i === 12) s.snare.triggerAttackRelease("16n", time);
    s.hat.triggerAttackRelease(250, "32n", time, i % 2 ? 0.4 : 0.8);
    if (i % 4 === 2) s.bass.triggerAttackRelease(T.Frequency(root).transpose(12), "16n", time);
    if ([0, 3, 6, 10, 12].includes(i)) s.stab.triggerAttackRelease(chord.map((n) => T.Frequency(n).transpose(12)), "16n", time, 0.6);
  },
};

// Slides smoothly to a new tempo. Only starts a new slide when the target really changes.
function slideTempo(bpm, seconds) {
  tempo = bpm;
  T.Transport.bpm.rampTo(bpm, seconds);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const nextSixteenth = () => T.Transport.nextSubdivision("16n");

// Called many times a second with what the dancer is doing.
export function follow(r) {
  if (!s || T.Transport.state !== "started") return;
  if (r.style !== style && r.style !== nextStyle) nextStyle = r.style;

  // Bouncing to Hip hop or House: the music speeds up or slows down to match the bounce.
  if (r.bpmFolded && (style === "hiphop" || style === "house") && !nextStyle) {
    const { min, max } = STYLES[style];
    const target = Math.min(max, Math.max(min, r.bpmFolded));
    if (Math.abs(tempo - target) > 2) slideTempo(target, 2);
  }

  // Hand moves play bell notes, on the beat grid so they stay in time. Higher hand = higher note.
  const now = T.now();
  for (const height of r.hands) {
    if (now - lastNote < 0.12) break;
    lastNote = now;
    const note = SCALE[Math.round(height * (SCALE.length - 1))];
    s.bells.triggerAttackRelease(note, "8n", nextSixteenth(), style === "flow" ? 0.7 : 0.45);
  }

  // Steps and stomps: a low tom in Flow, an extra drum hit in the others.
  if (r.steps) {
    if (style === "flow") s.bells.triggerAttackRelease("A2", "8n", nextSixteenth(), 0.4);
    else s.kick.triggerAttackRelease("G1", "16n", nextSixteenth(), 0.5);
  }

  // Jump: a crash and a deep boom, the "drop".
  if (r.jumped) {
    const at = nextSixteenth();
    s.crash.triggerAttackRelease("1n", at);
    s.kick.triggerAttackRelease("A0", "4n", at);
  }

  riser(r.armsUp); // arms up: a rising whoosh that builds while your arms stay up

  // Freeze: stand still and the music fades to a muffled hum; move and it opens back up.
  if (r.frozen !== frozen) {
    frozen = r.frozen;
    s.out.frequency.rampTo(frozen ? 350 : 18000, frozen ? 1 : 0.4);
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

export const currentStyle = () => ({ ...STYLES[nextStyle || style], key: nextStyle || style, bpm: Math.round(tempo) });

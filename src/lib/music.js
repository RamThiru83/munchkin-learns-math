/**
 * Music made with WebAudio (no audio files, so nothing to download and nothing to license).
 *
 *  - band(style): a looping backing track (drums, bass, chords, a bright lead) on a beat grid.
 *    Rhymes are chanted over it line by line, each line starting on a beat (src/app/sing.js).
 *  - homeLoop(): a soft music-box tune for the home page.
 *  - jingle(level): a short "ta-da" when a round is done.
 *  - motif(level): two bars that say "this is your level" when a level is picked.
 *
 * Every tune is original, built from chords of a major scale. One style per level (decision 0010).
 * The Music switch (settings.music) mutes all of it; the voice and sound effects have their own switches.
 */
import { settings, setMusicFlag } from './settings.js';
import { unlockAudio } from './audio.js';

/** One style per level, plus the home tune. root = MIDI note of the key. prog = scale degrees, one per bar. */
export const STYLES = {
  home: { bpm: 76, root: 60, lead: 'box', drums: 'none', prog: [0, 5, 3, 4], vol: 0.22 },
  1: { bpm: 100, root: 60, lead: 'pluck', drums: 'soft', prog: [0, 3, 4, 0], vol: 0.65 }, // Seeds: ukulele, C
  2: { bpm: 104, root: 65, lead: 'marimba', drums: 'pop', prog: [0, 5, 3, 4], vol: 0.65 }, // Sprouts: marimba, F
  3: { bpm: 110, root: 67, lead: 'xylo', drums: 'pop', prog: [0, 4, 5, 3], vol: 0.65 }, // Buds: xylophone, G
  4: { bpm: 100, root: 62, lead: 'steel', drums: 'island', prog: [0, 3, 0, 4], vol: 0.65 }, // Blossoms: steel drum, D
  5: { bpm: 112, root: 57, lead: 'box', drums: 'funk', prog: [0, 5, 1, 4], vol: 0.65 }, // Fruits: bells, A
};
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** The three notes (MIDI) of the triad on scale degree d. */
function triad(root, d) {
  return [0, 2, 4].map((s) => {
    const i = d + s;
    return root + SCALE[i % 7] + 12 * Math.floor(i / 7);
  });
}

// ---------- the mixer ----------
let mix = null; // { ctx, bus, out, noise }
function mixer() {
  if (mix) return mix;
  const ctx = unlockAudio();
  if (!ctx) return null;
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -14;
  out.ratio.value = 4;
  out.connect(ctx.destination);
  const bus = ctx.createGain();
  bus.gain.value = settings.music ? 1 : 0;
  bus.connect(out);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  mix = { ctx, bus, out, noise };
  return mix;
}

/** Turn music on or off (remembered on this device). */
export function setMusicOn(on) {
  setMusicFlag(on);
  if (mix) mix.bus.gain.setTargetAtTime(on ? 1 : 0, mix.ctx.currentTime, 0.05);
  if (!on) stopHome();
  else if (homeWanted) homeLoop();
}

// ---------- instruments: each plays one note at time t into `dest` ----------
function env(ctx, dest, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}
function osc(ctx, type, f, t, stop, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(dest);
  o.start(t);
  o.stop(stop);
  return o;
}
const INSTR = {
  marimba(ctx, dest, f, t, v) {
    const g = env(ctx, dest, t, v, 0.004, 0.45);
    osc(ctx, 'sine', f, t, t + 0.6, g);
    osc(ctx, 'sine', f * 4, t, t + 0.12, env(ctx, dest, t, v * 0.15, 0.002, 0.08));
  },
  xylo(ctx, dest, f, t, v) {
    const g = env(ctx, dest, t, v, 0.002, 0.25);
    osc(ctx, 'triangle', f * 2, t, t + 0.35, g);
    osc(ctx, 'sine', f * 6, t, t + 0.06, env(ctx, dest, t, v * 0.12, 0.001, 0.04));
  },
  box(ctx, dest, f, t, v) {
    const g = env(ctx, dest, t, v * 0.8, 0.003, 1.1);
    osc(ctx, 'sine', f * 2, t, t + 1.3, g);
    osc(ctx, 'sine', f * 5.4, t, t + 0.4, env(ctx, dest, t, v * 0.08, 0.002, 0.3));
  },
  steel(ctx, dest, f, t, v) {
    const g = env(ctx, dest, t, v, 0.006, 0.55);
    osc(ctx, 'sine', f, t, t + 0.7, g);
    osc(ctx, 'sine', f * 2, t, t + 0.5, env(ctx, dest, t, v * 0.35, 0.006, 0.3));
    osc(ctx, 'sine', f * 2.98, t, t + 0.3, env(ctx, dest, t, v * 0.15, 0.004, 0.18));
  },
  pluck(ctx, dest, f, t, v) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.3);
    lp.connect(env(ctx, dest, t, v * 0.7, 0.003, 0.4));
    osc(ctx, 'sawtooth', f, t, t + 0.5, lp);
  },
  bass(ctx, dest, f, t, v) {
    const g = env(ctx, dest, t, v, 0.01, 0.32);
    osc(ctx, 'triangle', f, t, t + 0.45, g);
  },
  pad(ctx, dest, f, t, v, len) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    g.connect(dest);
    osc(ctx, 'sine', f, t, t + len + 0.1, g);
    osc(ctx, 'sine', f * 1.005, t, t + len + 0.1, g);
  },
};
function drum(m, dest, kind, t, v) {
  const { ctx, noise } = m;
  if (kind === 'kick') {
    const g = env(ctx, dest, t, v, 0.002, 0.18);
    const o = osc(ctx, 'sine', 130, t, t + 0.25, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'shaker' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'shaker' ? 6500 : kind === 'clap' ? 1400 : 2500;
  src.connect(f);
  f.connect(env(ctx, dest, t, v, 0.002, kind === 'shaker' ? 0.035 : 0.11));
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.2);
}
const BEATS = {
  // per eighth note in a bar: k = kick, c = clap, s = shaker, x = nothing
  soft: ['k', 's', 'x', 's', 'c', 's', 'x', 's'],
  pop: ['k', 's', 'k', 's', 'c', 's', 'x', 's'],
  island: ['k', 'x', 's', 'k', 'c', 'x', 's', 's'],
  funk: ['k', 's', 'x', 'k', 'c', 's', 'k', 's'],
  none: [],
};
// Lead patterns: index into the chord's notes (0-2), 3 = top note an octave up, -1 = rest
const RIFFS = [
  [0, 1, 2, 1, 3, 2, 1, 2],
  [0, -1, 2, 1, 0, -1, 3, -1],
  [2, 1, 0, 1, 2, -1, 3, 2],
  [0, 2, 3, 2, 1, -1, 2, -1],
];

/**
 * Start a looping band in `style` (a key of STYLES). Returns a controller:
 *   beat (seconds), nextBeat(after) -> audio time of the next beat on or after `after`,
 *   now() -> audio time, duck(on) -> softer while someone sings, setLead(on), stop().
 */
export function band(style, { lite = false } = {}) {
  const m = mixer();
  const base = STYLES[style] || STYLES[1];
  // lite: the bed under a sung instruction (softer, no chords)
  const s = lite ? { ...base, vol: base.vol * 0.55, drums: base.drums === 'none' ? 'none' : 'soft' } : base;
  if (!m) return null;
  const { ctx } = m;
  const beat = 60 / s.bpm;
  const eighth = beat / 2;
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(s.vol, ctx.currentTime, 0.15);
  gain.connect(m.bus);
  const leadBus = ctx.createGain();
  leadBus.gain.value = lite ? 0.3 : 1;
  leadBus.connect(gain);
  const start = ctx.currentTime + 0.12;
  let step = 0; // eighth notes scheduled so far
  let riff = RIFFS[Math.floor(Math.random() * RIFFS.length)];
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const until = ctx.currentTime + 0.25;
    while (start + step * eighth < until) {
      const t = start + step * eighth;
      const bar = Math.floor(step / 8);
      const e = step % 8;
      const chord = triad(s.root, s.prog[bar % s.prog.length]);
      if (e === 0 && bar % 4 === 0) riff = RIFFS[(bar / 4 + RIFFS.indexOf(riff) + 1) % RIFFS.length];
      const hit = BEATS[s.drums][e];
      if (hit === 'k') drum(m, gain, 'kick', t, 0.5);
      if (hit === 'c') drum(m, gain, 'clap', t, 0.22);
      if (hit === 's') drum(m, gain, 'shaker', t, 0.08);
      if (s.drums !== 'none' && (e === 0 || e === 4 || (s.drums === 'funk' && e === 6)))
        INSTR.bass(ctx, gain, hz(chord[e === 4 ? 2 : 0] - 24), t, 0.32);
      if (e === 0 && !lite)
        chord.forEach((n) => INSTR.pad(ctx, gain, hz(n - 12), t, s.drums === 'none' ? 0.05 : 0.03, beat * 4));
      const r = riff[e];
      if (r >= 0 && (s.drums !== 'none' || e % 2 === 0)) {
        const note = r === 3 ? chord[0] + 12 : chord[r];
        INSTR[s.lead](ctx, leadBus, hz(note + 12), t, s.drums === 'none' ? 0.18 : 0.14);
      }
      step++;
    }
  };
  tick();
  const timer = setInterval(tick, 60);
  return {
    beat,
    bar: beat * 4,
    start,
    now: () => ctx.currentTime,
    nextBeat(after = ctx.currentTime) {
      const n = Math.ceil((after - start) / beat - 0.001);
      return start + Math.max(0, n) * beat;
    },
    duck(on) {
      gain.gain.setTargetAtTime(on ? s.vol * 0.5 : s.vol, ctx.currentTime, 0.08);
    },
    setLead(on) {
      leadBus.gain.setTargetAtTime(on ? 1 : 0.25, ctx.currentTime, 0.1);
    },
    stop(fade = 0.4) {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 4);
      setTimeout(() => gain.disconnect(), fade * 1000 + 600);
    },
  };
}

// ---------- the home tune ----------
let home = null;
let homeWanted = false;
/** Soft looping tune for the home page. Starts on the first tap (browsers block sound before one). */
export function homeLoop() {
  homeWanted = true;
  if (home || !settings.music) return;
  const m = mixer();
  if (!m) return;
  const go = () => {
    if (homeWanted && !home && settings.music && m.ctx.state === 'running') home = band('home');
  };
  if (m.ctx.state === 'running') go();
  else m.ctx.resume().then(go, () => {});
}
export function stopHome() {
  homeWanted = false;
  if (home) home.stop(0.8);
  home = null;
}

// ---------- short tunes ----------
function phrase(level, notes, { vol = 0.5, gap = 0.12 } = {}) {
  const m = mixer();
  if (!m || !settings.music) return 0;
  const s = STYLES[level] || STYLES[1];
  const g = m.ctx.createGain();
  g.gain.value = vol;
  g.connect(m.bus);
  const t0 = m.ctx.currentTime + 0.03;
  notes.forEach((n, i) => {
    if (n == null) return;
    INSTR[s.lead](m.ctx, g, hz(s.root + n + 12), t0 + i * gap, 0.22);
  });
  setTimeout(() => g.disconnect(), notes.length * gap * 1000 + 1500);
  return notes.length * gap;
}
/** "Ta-da!" when a round is done (about one second). */
export function jingle(level) {
  return phrase(level, [0, 4, 7, 12, null, 7, 12, 16], { vol: 0.45, gap: 0.11 });
}
/** The level's own little tune, when it is picked. */
export function motif(level) {
  const tunes = {
    1: [0, 0, 7, 7, 9, 9, 7],
    2: [4, 5, 7, 12, 9, 7],
    3: [0, 4, 7, 4, 9, 7, 12],
    4: [7, 4, 7, 9, 7, 4, 0],
    5: [12, 11, 9, 7, 9, 11, 12],
  };
  return phrase(level, tunes[level] || tunes[1], { vol: 0.35, gap: 0.13 });
}

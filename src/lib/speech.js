/**
 * Read-aloud.
 *
 * 1. Recorded voice (preferred): every sentence the site says is pre-recorded with Google's
 *    Chirp 3 HD "Achernar" voice (the Little Scientists Club narrator) and stored in voice packs,
 *    one per game plus one for the app shell: audio/voice/<pack>.bin (format in scripts/voice/pack.mjs).
 *    The packs are made by scripts/voice/ (see docs/VOICE.md).
 * 2. Fallback: the browser's built-in speech synthesis (English voices preferred: en-IN, en-GB, en-US),
 *    used for a whole line when any sentence of it has no recording (or audio cannot play).
 * Sentence rules are shared with the pack tools: keep sentences()/keyOf() in step with scripts/voice/text.mjs.
 */
import { settings, setVoiceFlag } from './settings.js';
import { unlockAudio } from './audio.js';

// The automated tests set this flag so that, with the voice off, lines do not take reading time.
let FAST_TESTS = false;
try {
  FAST_TESTS = localStorage.getItem('nilaa:fasttests') === '1';
} catch {
  /* no storage */
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|\uFE0F|\u200D/gu;
function sentences(text) {
  const t = String(text).replace(EMOJI, '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  return t
    .replace(/([.!?])\s+(?=\S)/g, '$1\n') // no lookbehind: Safari before 16.4 cannot parse it
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
const keyOf = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

// ---------- recorded voice ----------
const VOICE_BASE =
  typeof location !== 'undefined' && /\/src\/(index\.html)?$/.test(location.pathname)
    ? '../audio/voice/'
    : 'audio/voice/';
const clips = new Map(); // key -> { buf, at, len }: where the clip's MP3 sits in its pack
const packs = new Map(); // pack name -> Promise
const buffers = new Map(); // key -> Promise<AudioBuffer>
let ctx = null;
let current = null; // { source, stop() }
let token = 0;

/** Load a voice pack (e.g. 'app' or a game id). Safe to call many times; never throws. */
export function loadVoicePack(name) {
  if (!packs.has(name)) {
    const p = fetch(VOICE_BASE + encodeURIComponent(name) + '.bin')
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf) return;
        // 4-byte header length, JSON header { clips: { key: [offset, length] } }, then the MP3 data.
        const n = new DataView(buf).getUint32(0, true);
        const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
        for (const [k, [off, len]] of Object.entries(head.clips || {})) clips.set(k, { buf, at: 4 + n + off, len });
      })
      .catch(() => {});
    packs.set(name, p);
  }
  return packs.get(name);
}

/** The page's one AudioContext (shared with the sound effects). */
function audio() {
  if (ctx) return ctx;
  ctx = unlockAudio() || null;
  return ctx;
}

/** Resolves when a pack has loaded, or after `ms` at the latest (the site works either way). */
export function voiceReady(packPromise, ms) {
  return Promise.race([packPromise, new Promise((r) => setTimeout(r, ms))]);
}
// Browsers only allow sound after a tap: wake the audio context on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    // iPhone/iPad: let the recorded voice play even when the ring/silent switch is on (Safari 16.4+).
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }
    audio();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

function decode(key) {
  if (!buffers.has(key)) {
    const { buf, at, len } = clips.get(key);
    const bytes = buf.slice(at, at + len); // a copy: decodeAudioData takes ownership of it
    const c = audio();
    buffers.set(
      key,
      new Promise((res, rej) => c.decodeAudioData(bytes, res, rej)).catch((e) => {
        buffers.delete(key);
        throw e;
      }),
    );
  }
  return buffers.get(key);
}

function playBuffer(buf, my) {
  return new Promise((resolve) => {
    if (my !== token) return resolve(false);
    const c = audio();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true;
      if (current && current.source === src) current = null;
      resolve(ok);
    };
    src.onended = () => fin(true);
    current = {
      source: src,
      stop() {
        try {
          src.stop();
        } catch {
          /* ignore */
        }
        fin(false);
      },
    };
    src.start();
    // Safety net if 'ended' never fires (e.g. the tab is in the background).
    setTimeout(() => fin(true), buf.duration * 1000 + 1500);
  });
}

async function sayRecorded(keys, my, e) {
  const c = audio();
  if (c.state === 'suspended') {
    await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
    if (c.state !== 'running') return false;
  }
  const bufs = await Promise.all(keys.map(decode));
  e.dur = bufs.reduce((a, b) => a + b.duration, 0) + 0.12 * (bufs.length - 1);
  e.start = performance.now();
  for (let i = 0; i < bufs.length; i++) {
    if (my !== token) return true;
    if (i) await new Promise((r) => setTimeout(r, 120));
    if (!(await playBuffer(bufs[i], my))) return true;
  }
  return true;
}

// ---------- browser speech (fallback) ----------
let voiceCache = null;
function chooseVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  if (voiceCache) return voiceCache;
  const prefs = [/en[-_]IN/i, /en[-_]GB/i, /en[-_]US/i, /^en/i];
  for (const p of prefs) {
    const v =
      vs.find((x) => p.test(x.lang) && /female|samantha|karen|veena|google|serena|moira|kate|zira/i.test(x.name)) ||
      vs.find((x) => p.test(x.lang));
    if (v) {
      voiceCache = v;
      return v;
    }
  }
  return null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window)
  speechSynthesis.onvoiceschanged = () => {
    voiceCache = null;
  };

function sayBrowser(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(EMOJI, ''));
      const v = chooseVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = 'en-IN';
      u.rate = 0.9;
      u.pitch = 1.15;
      u.volume = 1;
      let done = false;
      const fin = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      u.onend = fin;
      u.onerror = fin;
      setTimeout(fin, 12000 + text.length * 80);
      speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking() {
  token++;
  if (current) current.stop();
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/** Note which voice spoke last (<html data-voice="recorded|browser">), for tests and troubleshooting. */
const mark = (v) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.voice = v;
};

/** Troubleshooting log of the last lines (open the site with ?voicelog and read window.__voiceLog). */
const log = [];
if (typeof window !== 'undefined' && /voicelog/.test(location.search)) window.__voiceLog = log;
const note = (e) => {
  if (!window.__voiceLog) return;
  log.push(e);
  if (log.length > 400) log.shift();
};

// Returns a promise that resolves when speech ends (or after a reading pause when voice is off).
export async function say(text, { cancel = true } = {}) {
  if (!text) return;
  if (!settings.voice) {
    // Voice off: the grown-up reads the banner, so give the line its reading time (games pace on this promise).
    if (cancel) stopSpeaking();
    const my = token;
    const ms = FAST_TESTS ? 40 : Math.min(2000, 250 + 30 * String(text).length);
    for (let t = 0; t < ms && my === token; t += 100) await new Promise((r) => setTimeout(r, 100));
    return;
  }
  if (cancel) stopSpeaking(); // cancel: false lets a line overlap the one already playing
  const my = token;
  const e = { t: String(text), req: performance.now(), start: 0, end: 0, src: '', cut: false, dur: 0 };
  note(e);
  try {
    await say2(text, my, e);
  } finally {
    e.end = performance.now();
    e.cut = my !== token;
  }
}
async function say2(text, my, e) {
  const keys = sentences(text).map(keyOf);
  if (keys.length && keys.every((k) => clips.has(k)) && audio()) {
    try {
      if (await sayRecorded(keys, my, e)) {
        mark('recorded');
        e.src = 'recorded';
        return;
      }
    } catch {
      /* fall back to the browser voice */
    }
  }
  if (my !== token) return;
  mark('browser');
  e.src = 'browser';
  e.start = performance.now();
  await sayBrowser(text);
}

/** Turn read-aloud on or off (and stop anything being spoken). */
export function setVoiceOn(on) {
  setVoiceFlag(on);
  if (!on) stopSpeaking();
}

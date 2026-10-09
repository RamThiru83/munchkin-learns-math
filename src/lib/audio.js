/**
 * Sound effects made with WebAudio (no audio files).
 * Names: tap, pop, good, oops, win, whoosh, step, drop, flip, tick.
 */
import { settings } from './settings.js';

let actx = null;

/** Create/resume the AudioContext. Browsers only allow this after a user gesture. */
export function unlockAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      actx = null;
    }
  }
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function tone(freq, dur = 0.15, { type = 'sine', vol = 0.12, delay = 0, slideTo = null } = {}) {
  const a = unlockAudio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
// names: tap, pop, good, oops, win, whoosh, step, drop, flip, tick
export function sfx(name) {
  if (!settings.sound) return;
  switch (name) {
    case 'tap':
      tone(520, 0.07, { type: 'triangle' });
      break;
    case 'pop':
      tone(700, 0.09, { type: 'sine', slideTo: 1000 });
      break;
    case 'drop':
      tone(300, 0.1, { type: 'triangle', slideTo: 200 });
      break;
    case 'step':
      tone(260, 0.06, { type: 'square', vol: 0.05 });
      break;
    case 'tick':
      tone(900, 0.04, { type: 'square', vol: 0.04 });
      break;
    case 'flip':
      tone(400, 0.12, { type: 'triangle', slideTo: 700 });
      break;
    case 'whoosh':
      tone(900, 0.25, { type: 'sine', vol: 0.06, slideTo: 200 });
      break;
    case 'good':
      tone(660, 0.12, { type: 'triangle' });
      tone(880, 0.16, { type: 'triangle', delay: 0.1 });
      break;
    case 'oops':
      tone(330, 0.16, { type: 'sine', vol: 0.09, slideTo: 260 });
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', delay: i * 0.11 }));
      break;
    default:
      tone(500, 0.08);
  }
}

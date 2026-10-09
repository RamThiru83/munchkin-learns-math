/** Read-aloud using the browser's built-in speech synthesis (English voices preferred: en-IN, en-GB, en-US). */
import { settings, setVoiceFlag } from './settings.js';

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
export function stopSpeaking() {
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
// Returns a promise that resolves when speech ends (or immediately when voice is off).
export function say(text, { cancel = true } = {}) {
  return new Promise((resolve) => {
    if (!settings.voice || !('speechSynthesis' in window) || !text) return resolve();
    try {
      if (cancel) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
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

/** Turn read-aloud on or off (and stop anything being spoken). */
export function setVoiceOn(on) {
  setVoiceFlag(on);
  if (!on) stopSpeaking();
}

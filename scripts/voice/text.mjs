// Shared text rules for the recorded voice. src/lib/speech.js uses the same rules: keep them in step.
import { createHash } from 'node:crypto';

export const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|\uFE0F|\u200D/gu;

/** Split what the site says into sentences (the unit that is recorded). */
export function sentences(text) {
  const t = String(text).replace(EMOJI, '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  return t
    .replace(/([.!?])\s+(?=\S)/g, '$1\n') // no lookbehind: Safari before 16.4 cannot parse it
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lookup key for one sentence. */
export const keyOf = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/** File name of the recorded clip for a key. */
export const clipName = (k) => createHash('sha1').update(k).digest('hex').slice(0, 16) + '.mp3';

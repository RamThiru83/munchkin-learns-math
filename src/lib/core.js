/**
 * Everything a game may import. Games import ONLY from this file:
 *   import { h, sleep, shuffle, drag, sfx } from '../lib/core.js';
 * The same functions are also passed to every game on its `api` object.
 * Add new shared helpers to a focused module in this folder and re-export them here.
 */
export { h } from './dom.js';
export { sleep, rand, pick, shuffle, range } from './random.js';
export { store } from './storage.js';
export { settings, setSound } from './settings.js';
export { sfx, unlockAudio } from './audio.js';
export { say, stopSpeaking, setVoiceOn } from './speech.js';
export { confetti } from './confetti.js';
export { drag, glideBack, flyTo } from './drag.js';
export { COLORS } from './colors.js';
export { resumeRound } from './rounds.js';

/** Grown-up settings (sound effects and voice), remembered on this device. */
import { store } from './storage.js';

export const settings = { sound: store.get('sound', true), voice: store.get('voice', true) };
export function setSound(on) {
  settings.sound = on;
  store.set('sound', on);
}
/** Only stores the flag. Use setVoiceOn from speech.js (re-exported by core.js), which also stops speech. */
export function setVoiceFlag(on) {
  settings.voice = on;
  store.set('voice', on);
}

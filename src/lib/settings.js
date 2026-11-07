/** Grown-up settings (sound effects, voice and music), remembered on this device. */
import { store } from './storage.js';

export const settings = {
  sound: store.get('sound', true),
  voice: store.get('voice', true),
  music: store.get('music', true),
};
export function setSound(on) {
  settings.sound = on;
  store.set('sound', on);
}
/** Only stores the flag. Use setVoiceOn from speech.js (re-exported by core.js), which also stops speech. */
export function setVoiceFlag(on) {
  settings.voice = on;
  store.set('voice', on);
}
/** Only stores the flag. Use setMusicOn from music.js (re-exported by core.js), which also fades the music. */
export function setMusicFlag(on) {
  settings.music = on;
  store.set('music', on);
}

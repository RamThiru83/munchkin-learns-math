/**
 * Rhyme time: a card that chants four lines over the level's tune, lighting up each word as it is said
 * (decision 0010). Used before a game starts (RHYMES) and on the finish card (SONGS).
 *
 *   const card = songCard({ lines, level, title, move });
 *   parent.append(card.el);
 *   await card.play();   // 'done' or 'stopped'
 *   card.stop();         // safe to call any time
 *
 * Each line starts on a beat of the band; the band goes quieter while a line is said. With the voice off
 * the words still light up at chanting speed; with the music off the lines are chanted without the band.
 */
import { h, settings, band, say, stopSpeaking } from '../lib/core.js';
import { loadVoicePack, voiceReady, lineDuration } from '../lib/speech.js';
import { owl } from './ui.js';

const NOTE =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M9 18.5V5.5l10-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18.5" r="2.8" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.8" fill="currentColor"/></svg>';
const MOVE_WORD = { clap: 'Clap along!', wiggle: 'Wiggle!', jump: 'Jump!', spin: 'Spin around!', dance: 'Dance!' };

export function songCard({ lines, level = 1, title = 'Rhyme time!', move = null }) {
  const pal = h('div', { class: 'song-owl' }, owl(96));
  const notes = h(
    'div',
    { class: 'song-notes', 'aria-hidden': 'true' },
    [0, 1, 2].map((i) => h('span', { class: `note n${i}`, html: NOTE })),
  );
  const items = lines.map((line, i) =>
    h(
      'li',
      { class: i === 2 && move ? 'move-line' : '' },
      line.split(' ').flatMap((w, k) => (k ? [' ', h('span', { class: 'w' }, w)] : [h('span', { class: 'w' }, w)])),
    ),
  );
  const moveTag = move ? h('p', { class: 'move-tag', hidden: true }, MOVE_WORD[move] || '') : null;
  const el = h(
    'div',
    { class: `song lv${level}`, role: 'region', 'aria-label': title },
    h('div', { class: 'song-stage' }, notes, pal),
    h('h2', { class: 'song-title' }, title),
    h('ol', { class: 'lyrics' }, items),
    moveTag,
  );

  let stopped = false;
  let bandCtl = null;
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const wait = (ms) => new Promise((r) => later(r, Math.max(0, ms)));

  function stop() {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    timers.clear();
    stopSpeaking();
    bandCtl?.stop(0.5);
    el.classList.remove('playing');
  }

  async function play() {
    await voiceReady(loadVoicePack('songs'), 3000);
    if (stopped) return 'stopped';
    const durs = await Promise.all(lines.map(lineDuration));
    if (stopped) return 'stopped';
    bandCtl = settings.music ? band(level) : null;
    const beat = bandCtl ? bandCtl.beat : 0.6;
    el.style.setProperty('--beat', `${beat}s`);
    el.classList.add('playing');
    // one bar of tune before the first line
    let at = bandCtl ? bandCtl.nextBeat(bandCtl.now() + beat * 3.5) : 0;
    for (let i = 0; i < lines.length; i++) {
      if (bandCtl) await wait((at - bandCtl.now()) * 1000);
      if (stopped) return 'stopped';
      items.forEach((li, k) => li.classList.toggle('now', k === i));
      if (i === 2 && moveTag) {
        moveTag.hidden = false;
        pal.classList.add(`move-${move}`);
      }
      const words = items[i].querySelectorAll('.w');
      const per = (durs[i] * 1000) / words.length;
      words.forEach((w, k) => later(() => w.classList.add('lit'), k * per));
      bandCtl?.duck(true);
      if (settings.voice) await say(lines[i]);
      else await wait(durs[i] * 1000);
      bandCtl?.duck(false);
      if (stopped) return 'stopped';
      items[i].classList.add('sung');
      if (bandCtl) at = bandCtl.nextBeat(bandCtl.now() + 0.12);
    }
    items.forEach((li) => li.classList.remove('now'));
    await wait(bandCtl ? beat * 2000 : 400);
    if (stopped) return 'stopped';
    bandCtl?.stop(0.9);
    bandCtl = null;
    el.classList.remove('playing');
    el.classList.add('finished');
    return 'done';
  }

  return { el, play, stop };
}

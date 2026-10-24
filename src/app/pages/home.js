/**
 * Home page. Route: #/
 *
 * Made for a child of four to seven who may not read yet (decisions 0008 and 0009):
 *   top      the name, and the grown-up switches (voice, sound, the guide) kept small at the side
 *   play     one big card: the picture of the game she should play next and a big Play button
 *   levels   five picture buttons, one per level (a seed, a sprout, a bud, a blossom, an apple)
 *   chapters one colour field per level: its drawing and name, then its games as big pictures to tap
 *   about    a short statement for the grown-up nearby
 *   footer   the name built from blocks, settings, credits
 * Every game and level can be chosen from its picture alone; the words are there for the grown-up.
 */
import { h, sfx, settings, setSound, setVoiceOn } from '../../lib/core.js';
import { LEVELS, ACTIVITIES } from '../../content/registry.js';
import { AGE_LEVELS } from '../../content/age-guide.js';
import { BOOK } from '../../content/book.js';
import { starsFor, totalStars, finishedCount, savedRound } from '../progress.js';
import { owl, toggle, bookCitation, revealOnScroll } from '../ui.js';
import { stageGlyph, starRow, starIcon, icon } from '../glyphs.js';
import { loadVoicePack } from '../../lib/speech.js';
import { APP_VERSION } from '../version.js';

/** Pictures of each game's first round live in img/games/ (made by scripts/shots.mjs). */
const IMG_BASE =
  typeof location !== 'undefined' && /\/src\/(index\.html)?$/.test(location.pathname) ? '../img/games/' : 'img/games/';
export const gamePicture = (id, large = false) => `${IMG_BASE}${id}${large ? '-l' : ''}.webp`;

const chapterId = (lv) => `stage-${lv.name.toLowerCase()}`;
const levelGames = (n) => ACTIVITIES.filter((a) => a.level === n);
const playedIn = (n) => finishedCount(levelGames(n).map((a) => a.id));
const levelOf = (a) => LEVELS.find((l) => l.n === a.level);

function scrollToLevel(lv) {
  sfx('tap');
  const el = document.getElementById(chapterId(lv));
  el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el?.querySelector('h2')?.focus({ preventScroll: true });
}

export function renderHome(app) {
  app.className = 'page-home';
  const next = ACTIVITIES.find((a) => !starsFor(a.id)) || null;
  const inProgress = ACTIVITIES.find((a) => savedRound(a.id)) || null;
  // Fetch the voice for the app and the game the child will most likely open next.
  loadVoicePack('app');
  if (inProgress) loadVoicePack(inProgress.id);
  else if (next) loadVoicePack(next.id);

  const cleanups = [];
  app.append(
    top(),
    h('main', { id: 'main' }, playCard(next, inProgress), levelPicker(), levelBar(), chapters(next)),
    about(),
    footer(),
  );
  watchChapters(app, cleanups);
  cleanups.push(revealOnScroll(app));
  return { destroy: () => cleanups.forEach((f) => f()) };
}

// ---------------------------------------------------------------- top row
function top() {
  return h(
    'header',
    { class: 'top' },
    h('span', { class: 'mark' }, owl(52), h('h1', {}, 'Munchkin Learns Math')),
    h(
      'nav',
      { class: 'top-tools', 'aria-label': 'Settings for grown-ups' },
      toggle('Voice', () => settings.voice, setVoiceOn, 'tool', ['voice', 'voiceOff']),
      toggle('Sound', () => settings.sound, setSound, 'tool', ['sound', 'soundOff']),
      h(
        'a',
        { class: 'tool', href: '#/grownups' },
        h('span', { class: 'pic' }, icon('grownups')),
        h('span', { class: 'lbl' }, 'Grown-ups'),
      ),
    ),
  );
}

// ---------------------------------------------------------------- the big play card
function playCard(next, inProgress) {
  const pick = inProgress || next || ACTIVITIES[0];
  const saved = inProgress ? savedRound(inProgress.id) : null;
  const lv = levelOf(pick);
  const verb = saved ? 'Carry on' : next ? 'Play' : 'Play again';
  const played = finishedCount(ACTIVITIES.map((a) => a.id));
  return h(
    'section',
    { class: `playcard lv${lv.n}`, 'aria-labelledby': 'play-h' },
    h(
      'a',
      { class: 'playcard-link', href: `#/play/${pick.id}`, onclick: () => sfx('pop') },
      h(
        'span',
        { class: 'playcard-pic' },
        h('img', { src: gamePicture(pick.id, true), alt: '', width: 960, height: 720, fetchpriority: 'high' }),
        h('span', { class: 'bigplay', 'aria-hidden': 'true' }, icon('play', 64)),
      ),
      h(
        'span',
        { class: 'playcard-text' },
        h('h2', { id: 'play-h', class: 'playcard-title' }, pick.title),
        h('span', { class: 'playcard-sub' }, pick.blurb),
        h(
          'span',
          { class: 'playcard-kicker' },
          stageGlyph(lv.n, 'mini-glyph'),
          `${lv.name} · game ${ACTIVITIES.indexOf(pick) + 1}`,
        ),
        saved ? h('span', { class: 'playcard-sub strong' }, `Round ${saved.r + 1} of ${saved.n}`) : null,
        h('span', { class: 'go' }, icon('play', 30), h('span', {}, verb)),
      ),
    ),
    h(
      'p',
      { class: 'count' },
      starIcon(true, 24),
      ` ${totalStars()} stars · ${played} of ${ACTIVITIES.length} games played`,
    ),
  );
}

// ---------------------------------------------------------------- level picker (pictures)
function levelPicker() {
  return h(
    'section',
    { class: 'levels', 'aria-labelledby': 'levels-h' },
    h('h2', { id: 'levels-h', class: 'levels-h' }, 'Pick a level'),
    h(
      'ul',
      { class: 'level-list' },
      LEVELS.map((lv) =>
        h(
          'li',
          {},
          h(
            'button',
            { class: `level-btn lv${lv.n}`, type: 'button', onclick: () => scrollToLevel(lv) },
            stageGlyph(lv.n, 'level-glyph'),
            h('strong', {}, lv.name),
            h('span', {}, `${playedIn(lv.n)} of ${levelGames(lv.n).length} played`),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------- sticky level bar
function levelBar() {
  return h(
    'nav',
    { class: 'levelbar lv1', 'aria-label': 'Levels' },
    h(
      'div',
      { class: 'levelbar-in' },
      LEVELS.map((lv) =>
        h(
          'button',
          {
            type: 'button',
            'data-lv': lv.n,
            style: `--btn-lv: var(--c-lv${lv.n})`,
            onclick: () => scrollToLevel(lv),
          },
          stageGlyph(lv.n, 'bar-glyph'),
          h('span', { class: 'lb-name' }, lv.name),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------- chapters
function chapters(next) {
  return h(
    'div',
    { class: 'chapters' },
    LEVELS.map((lv) => {
      const games = levelGames(lv.n);
      const band = (AGE_LEVELS.find((x) => x.n === lv.n)?.band || '').replace(/–/g, '–⁠');
      return h(
        'section',
        { class: `chapter lv${lv.n}`, id: chapterId(lv), 'data-lv': lv.n, 'aria-labelledby': `${chapterId(lv)}-h` },
        h(
          'div',
          { class: 'chapter-head reveal' },
          stageGlyph(lv.n, 'stage-glyph'),
          h(
            'div',
            {},
            h('h2', { id: `${chapterId(lv)}-h`, tabindex: '-1' }, lv.name),
            h('p', { class: 'chapter-lead' }, `Level ${lv.n}: ${lv.blurb.toLowerCase()}. For ${band}.`),
          ),
        ),
        h(
          'ul',
          { class: 'games' },
          games.map((a) => h('li', { class: 'reveal' }, tile(a, next))),
        ),
      );
    }),
  );
}

function tile(a, next) {
  const stars = starsFor(a.id);
  const saved = savedRound(a.id);
  const isNext = !!next && next.id === a.id && !saved;
  let status;
  if (saved) status = h('span', { class: 'resume-tag' }, `Round ${saved.r + 1} of ${saved.n}`);
  else if (isNext) status = h('span', { class: 'next-tag' }, icon('play', 18), 'Play next');
  else status = starRow(stars, 3, 26);
  return h(
    'a',
    {
      class: `tile ${stars ? 'done' : ''} ${isNext ? 'next' : ''}`,
      href: `#/play/${a.id}`,
      onclick: () => sfx('pop'),
    },
    h(
      'span',
      { class: 'tile-pic' },
      h('img', { class: 'thumb', src: gamePicture(a.id), alt: '', width: 480, height: 360, loading: 'lazy' }),
    ),
    h('strong', { class: 'tile-title' }, a.title),
    h('span', { class: 'tile-status' }, status),
    h('span', { class: 'sub' }, a.blurb),
  );
}

// ---------------------------------------------------------------- about
function about() {
  const mark = (text, n) => h('mark', { class: `hl lv${n}` }, text);
  return h(
    'section',
    { class: 'about', 'aria-labelledby': 'about-h' },
    h('h2', { id: 'about-h', class: 'about-h reveal' }, 'For grown-ups'),
    h(
      'p',
      { class: 'about-text reveal' },
      'Original games from ',
      mark('a real preschool maths circle', 1),
      ' (Zvonkin, ',
      h('em', {}, 'Math from Three to Seven'),
      '). ',
      mark('Five rounds', 2),
      ' each, read aloud. ',
      mark('No sign-in', 3),
      '; stars stay on this device. Sit beside her and ask ',
      mark('“How do you know?”', 4),
      ' ',
      h('a', { class: 'hl-link', href: '#/grownups' }, 'Guide, ages and game notes'),
    ),
  );
}

// ---------------------------------------------------------------- footer
function footer() {
  const word = 'munchkin';
  const heights = [100, 78, 92, 66, 100, 84, 72, 96];
  const blocks = h(
    'div',
    { class: 'blockmark', role: 'img', 'aria-label': 'Munchkin' },
    [...word].map((ch, i) =>
      h('span', { class: `blk-letter lv${(i % 5) + 1}`, style: `--hgt:${heights[i]}%` }, h('span', {}, ch)),
    ),
  );
  return h(
    'footer',
    { class: 'foot' },
    blocks,
    h(
      'div',
      { class: 'foot-cols' },
      h(
        'div',
        {},
        h('h2', {}, 'Levels'),
        h(
          'ul',
          {},
          LEVELS.map((lv) =>
            h(
              'li',
              {},
              h('button', { type: 'button', class: 'linkish', onclick: () => scrollToLevel(lv) }, `${lv.n} ${lv.name}`),
            ),
          ),
        ),
      ),
      h(
        'div',
        {},
        h('h2', {}, 'Grown-ups'),
        h(
          'ul',
          {},
          h('li', {}, h('a', { href: '#/grownups' }, 'How to use it')),
          h('li', {}, h('a', { href: '#/grownups' }, 'Ages for each level')),
          h('li', {}, h('a', { href: '#/grownups' }, 'Notes on every game')),
        ),
      ),
      h(
        'div',
        {},
        h('h2', {}, 'Settings'),
        h(
          'ul',
          {},
          h(
            'li',
            {},
            toggle('Voice', () => settings.voice, setVoiceOn, 'linkish'),
          ),
          h(
            'li',
            {},
            toggle('Sound', () => settings.sound, setSound, 'linkish'),
          ),
        ),
      ),
      h(
        'div',
        { class: 'foot-credit' },
        h('h2', {}, 'Inspired by'),
        h('p', {}, ...bookCitation(BOOK)),
        h('p', {}, 'Original games, drawings and words. Not affiliated with the book’s author or publisher.'),
      ),
    ),
    h(
      'div',
      { class: 'foot-last' },
      h('span', {}, `Munchkin Learns Math · version ${APP_VERSION}`),
      h(
        'button',
        {
          type: 'button',
          class: 'pill',
          onclick: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.querySelector('.playcard-link')?.focus({ preventScroll: true });
          },
        },
        icon('up', 20),
        'Back to the top',
      ),
    ),
  );
}

// ---------------------------------------------------------------- motion
/** The level bar takes the colour of the chapter under it, and marks that level. */
function watchChapters(app, cleanups) {
  const bar = app.querySelector('.levelbar');
  const sections = [...app.querySelectorAll('.chapter')];
  const set = (n) => {
    bar.className = `levelbar lv${n}`;
    bar.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.lv === String(n);
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  };
  set(1);
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) set(e.target.dataset.lv);
    },
    { rootMargin: '-80px 0px -80% 0px' },
  );
  sections.forEach((s) => io.observe(s));
  cleanups.push(() => io.disconnect());
}

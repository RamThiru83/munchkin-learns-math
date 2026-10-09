/** Home page: the map of levels and game tiles. Route: #/ */
import { h, sfx, settings, setSound, setVoiceOn } from '../../lib/core.js';
import { LEVELS, ACTIVITIES } from '../../content/registry.js';
import { BOOK } from '../../content/book.js';
import { starsFor, totalStars, finishedCount, savedRound } from '../progress.js';
import { owl, toggle, bookCitation } from '../ui.js';

export function renderHome(app) {
  app.className = 'page-home';
  const next = ACTIVITIES.find((a) => !starsFor(a.id)) || null;
  const header = h(
    'header',
    { class: 'hero' },
    h('div', { class: 'hero-owl' }, owl(96)),
    h(
      'div',
      {},
      h('h1', {}, 'Munchkin Learns Math'),
      h('p', { class: 'tag' }, 'Little games for curious minds — from easy to tricky.'),
      h(
        'p',
        { class: 'count' },
        `⭐ ${totalStars()} stars · ${finishedCount(ACTIVITIES.map((a) => a.id))} of ${ACTIVITIES.length} games played`,
      ),
    ),
    h(
      'div',
      { class: 'hero-btns' },
      toggle('🗣️', 'Voice', () => settings.voice, setVoiceOn),
      toggle('🔊', 'Sound', () => settings.sound, setSound),
      h('a', { class: 'btn small', href: '#/grownups' }, 'For grown-ups'),
    ),
  );

  const map = h('main', { class: 'map' });
  for (const lv of LEVELS) {
    map.append(
      h(
        'section',
        { class: `level lv${lv.n}` },
        h('h2', {}, h('span', { class: 'lv-emoji' }, lv.emoji), ` Level ${lv.n}: ${lv.name}`, h('small', {}, lv.blurb)),
        h(
          'div',
          { class: 'tiles' },
          ACTIVITIES.filter((a) => a.level === lv.n).map((a) => tile(a, next)),
        ),
      ),
    );
  }

  const footer = h(
    'footer',
    { class: 'foot' },
    'Inspired by: ',
    ...bookCitation(BOOK),
    ' Original games, drawings and words.',
  );
  app.append(header, map, footer);
}

function tile(a, next) {
  const stars = starsFor(a.id);
  const saved = savedRound(a.id);
  const isNext = next && next.id === a.id;
  let status = '';
  if (stars) status = '⭐'.repeat(stars);
  else if (!saved && isNext) status = 'Play next!';
  return h(
    'a',
    {
      class: `tile ${stars ? 'done' : ''} ${isNext ? 'next' : ''}`,
      href: `#/play/${a.id}`,
      onclick: () => sfx('pop'),
    },
    h('span', { class: 'num' }, ACTIVITIES.indexOf(a) + 1),
    h('span', { class: 'big' }, a.emoji),
    h('strong', {}, a.title),
    h('span', { class: 'sub' }, a.blurb),
    h('span', { class: 'stars' }, status),
    saved ? h('span', { class: 'resume-tag' }, `▶ Round ${saved.r + 1} of ${saved.n}`) : null,
  );
}

/** "For grown-ups" page: how to use the site, the research-based age guide, game notes and references. Route: #/grownups */
import { h } from '../../lib/core.js';
import { LEVELS, ACTIVITIES } from '../../content/registry.js';
import { AGE_INTRO, AGE_LEVELS, AGE_CAVEAT, AGE_REFS } from '../../content/age-guide.js';
import { BOOK } from '../../content/book.js';
import { loaders } from '../../activities/index.js';
import { bookCitation } from '../ui.js';
import { APP_VERSION } from '../version.js';

const ABOUT =
  'Munchkin Learns Math is a set of small, original games inspired by the activities of a real preschool maths circle, described in Alexander Zvonkin’s book “Math from Three to Seven”. The games run in any browser, need no sign-in, and store only stars on this device. Each game has five rounds that get a little harder each time.';

const TIPS =
  'Tips: sit alongside, let her try before you explain, and use the “Watch” button only when she is stuck. There are no scores to lose and no timers — mistakes simply bounce back. Turn Voice off on the map if you prefer to read aloud yourself. Progress is saved after every round on this device: leave a game part-way and it will offer to carry on from the same round next time (the round in progress starts fresh). ↻ Again restarts just the current round.';

const DISCLAIMER =
  'This site is an independent educational project and is not affiliated with the book’s author or publisher. The games, drawings and wording are original; please read the book itself for the full story and the children’s own words.';

export function renderGrownups(app) {
  app.className = 'page-grownups';
  const notes = h('div', { class: 'notes' }, h('p', {}, 'Loading notes…'));
  app.append(
    h(
      'main',
      { class: 'grown' },
      h('a', { class: 'btn small', href: '#/' }, '← Back to the map'),
      h('h1', {}, 'For grown-ups'),
      h('p', {}, ABOUT),
      h('p', {}, TIPS),
      ageGuide(),
      h('h2', {}, 'About each game'),
      notes,
    ),
  );
  fillNotes(notes);
}

/** Per-level game notes (each game's `parentNote`), then references. Loaded lazily because notes live in the game modules. */
async function fillNotes(notes) {
  const parts = [];
  for (const lv of LEVELS) {
    parts.push(
      h(
        'h3',
        { class: 'lvhead' },
        `Level ${lv.n}: ${lv.name} — ${lv.blurb}`,
        h('span', { class: 'ageband' }, AGE_LEVELS.find((x) => x.n === lv.n)?.band || ''),
      ),
    );
    for (const a of ACTIVITIES.filter((x) => x.level === lv.n)) {
      let note;
      try {
        note = (await loaders[a.id]()).default.parentNote;
      } catch {
        note = '(coming soon)';
      }
      parts.push(h('div', { class: 'note' }, h('h4', {}, `${a.emoji} ${a.title}`), h('p', {}, note || a.blurb)));
    }
  }
  parts.push(
    h('h2', { id: 'age-refs' }, 'Age guide references'),
    h(
      'ol',
      { class: 'refs' },
      AGE_REFS.map((r, i) => h('li', { id: `ref-${i + 1}` }, linkify(r))),
    ),
    h('h2', {}, 'Reference'),
    h('p', { class: 'ref' }, ...bookCitation(BOOK, { long: true })),
    h('p', { class: 'small' }, DISCLAIMER),
    h('p', { class: 'small version' }, `Version ${APP_VERSION}`),
  );
  notes.replaceChildren(...parts);
}

function ageGuide() {
  return h(
    'section',
    { class: 'ages' },
    h('h2', {}, 'What age is each level for?'),
    h('p', {}, ...cite(AGE_INTRO)),
    ...AGE_LEVELS.map((a) => {
      const lv = LEVELS.find((x) => x.n === a.n);
      return h(
        'div',
        { class: `agecard lv${a.n}` },
        h('h3', {}, `${lv.emoji} Level ${a.n}: ${lv.name}`, h('span', { class: 'ageband' }, a.band)),
        h('p', {}, ...cite(a.text)),
        a.games.length
          ? h(
              'ul',
              {},
              a.games.map(([g, t]) => h('li', {}, h('strong', {}, `${g}: `), ...cite(t))),
            )
          : null,
      );
    }),
    h('p', { class: 'small' }, AGE_CAVEAT),
  );
}

/** Turn "[1]" / "[1, 2]" in a text into superscript links that scroll to the reference list. */
function cite(text) {
  const out = [];
  const re = /\[(\d+(?:,\s*\d+)*)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    out.push(text.slice(last, m.index));
    const nums = m[1].split(/,\s*/);
    out.push(h('sup', { class: 'cite' }, '[', ...nums.flatMap((n, i) => [i ? ', ' : '', refLink(n)]), ']'));
    last = re.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

function refLink(n) {
  return h(
    'a',
    {
      href: `#ref-${n}`,
      onclick: (e) => {
        e.preventDefault(); // plain #ref-n would be taken by the hash router
        document.getElementById(`ref-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
    n,
  );
}

/** Make a trailing URL in a reference clickable. */
function linkify(text) {
  const m = text.match(/(https?:\/\/\S+)$/);
  if (!m) return text;
  return [text.slice(0, m.index), h('a', { href: m[1], target: '_blank', rel: 'noopener' }, m[1])];
}

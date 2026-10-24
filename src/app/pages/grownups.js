/** "For grown-ups" page: how to use the site, the research-based age guide, game notes and references. Route: #/grownups */
import { h } from '../../lib/core.js';
import { LEVELS, ACTIVITIES } from '../../content/registry.js';
import { AGE_INTRO, AGE_LEVELS, AGE_CAVEAT, AGE_REFS } from '../../content/age-guide.js';
import { BOOK } from '../../content/book.js';
import { loaders } from '../../activities/index.js';
import { bookCitation } from '../ui.js';
import { gamePicture } from './home.js';
import { APP_VERSION } from '../version.js';
import { GISTS } from '../../content/gists.js';

const HOW_TO = [
  'Sit beside her. Let her try before you explain.',
  'Watch shows how to play. Use it only when she is stuck.',
  'No timers, no scores to lose. Again restarts the round.',
  'Stars and the round reached are saved on this device only. No sign-in.',
];

const DISCLAIMER =
  'Independent project, not affiliated with the book’s author or publisher. Games, drawings and wording are original.';

export function renderGrownups(app) {
  app.className = 'page-grownups';
  const notes = h('div', { class: 'notes' }, h('p', {}, 'Loading notes…'));
  app.append(
    h(
      'main',
      { class: 'grown' },
      h(
        'nav',
        { class: 'grown-top', 'aria-label': 'Site' },
        h('a', { class: 'grown-name', href: '#/' }, 'Munchkin Learns Math'),
        h('a', { class: 'pill back', href: '#/' }, 'Back to the games'),
      ),
      h('h1', {}, 'For grown-ups'),
      h(
        'p',
        { class: 'grown-lead' },
        'Thirty short maths games from a real preschool maths circle, ',
        h('em', {}, 'Math from Three to Seven'),
        ' (Zvonkin). Five rounds each, read aloud.',
      ),
      h('h2', {}, 'How to play together'),
      h(
        'ul',
        { class: 'howto' },
        HOW_TO.map((t) => h('li', {}, t)),
      ),
      ageGuide(),
      h('h2', {}, 'The games, in one line each'),
      notes,
    ),
  );
  fillNotes(notes).then(() => settleIn(app));
}

/** Per-level game notes (each game's `parentNote`), then references. Loaded lazily because notes live in the game modules. */
async function fillNotes(notes) {
  const parts = [];
  for (const lv of LEVELS) {
    parts.push(
      h(
        'h3',
        { class: `lvhead lv${lv.n}` },
        `${lv.n} · ${lv.name}`,
        h('span', { class: 'ageband' }, shortBand(AGE_LEVELS.find((x) => x.n === lv.n)?.band || '')),
      ),
    );
    const row = h('div', { class: 'notes-level' });
    parts.push(row);
    for (const a of ACTIVITIES.filter((x) => x.level === lv.n)) {
      let mod;
      try {
        mod = (await loaders[a.id]()).default;
      } catch {
        mod = { parentNote: '(coming soon)' };
      }
      const talk =
        Array.isArray(mod.talkPrompts) && mod.talkPrompts.length
          ? h('p', { class: 'talk-note' }, h('strong', {}, 'Ask together: '), mod.talkPrompts.join(' · '))
          : null;
      const [gist, ask] = GISTS[a.id] || [a.blurb, ''];
      row.append(
        h(
          'div',
          { class: `note lv${lv.n}` },
          h('img', { src: gamePicture(a.id), alt: '', width: 480, height: 360 }),
          h(
            'div',
            { class: 'note-body' },
            h('h4', {}, a.title),
            h('p', {}, gist),
            ask ? h('p', { class: 'ask' }, h('strong', {}, 'Ask: '), `“${ask}”`) : null,
            h('details', {}, h('summary', {}, 'More'), h('p', {}, mod.parentNote || a.blurb), talk),
          ),
        ),
      );
    }
  }
  parts.push(
    h(
      'details',
      { class: 'refs-box', id: 'age-refs' },
      h('summary', {}, `References (${AGE_REFS.length + 1})`),
      h('p', { class: 'ref' }, ...bookCitation(BOOK, { long: true })),
      h(
        'ol',
        { class: 'refs' },
        AGE_REFS.map((r, i) => h('li', { id: `ref-${i + 1}` }, linkify(r))),
      ),
    ),
    h('p', { class: 'small' }, DISCLAIMER),
    h('p', { class: 'small version' }, `Version ${APP_VERSION}`),
  );
  notes.replaceChildren(...parts);
}

function ageGuide() {
  return h(
    'section',
    { class: 'ages' },
    h('h2', {}, 'Ages for each level'),
    h(
      'p',
      { class: 'ages-note' },
      'Rough ranges, not milestones. Children vary. Stretch games are puzzles to do together.',
    ),
    h(
      'div',
      { class: 'agegrid' },
      AGE_LEVELS.map((a) => {
        const lv = LEVELS.find((x) => x.n === a.n);
        return h(
          'div',
          { class: `agecard lv${a.n}` },
          h('h3', {}, `${a.n} · ${lv.name}`),
          h('span', { class: 'ageband' }, shortBand(a.band)),
          h('p', {}, lv.blurb),
        );
      }),
    ),
    h(
      'details',
      { class: 'research' },
      h('summary', {}, 'The research behind these ages'),
      h('p', {}, ...cite(AGE_INTRO)),
      ...AGE_LEVELS.flatMap((a) => {
        const lv = LEVELS.find((x) => x.n === a.n);
        return [
          h('h4', {}, `${a.n} · ${lv.name}, ${a.band}`),
          h('p', {}, ...cite(a.text)),
          a.games.length
            ? h(
                'ul',
                {},
                a.games.map(([g, t]) => h('li', {}, h('strong', {}, `${g}: `), ...cite(t))),
              )
            : null,
        ];
      }),
      h('p', { class: 'small' }, AGE_CAVEAT),
    ),
  );
}

/** "about 4½–6 years, with several stretch games" -> "4½–6 years" (the full wording is under the research). */
function shortBand(band) {
  return band
    .replace(/^about /, '')
    .replace(/[,;].*$/, '')
    .replace(/ and up.*$/, '+');
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
        const box = document.getElementById('age-refs');
        if (box) box.open = true;
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

/** Cards and notes below the fold glide up 28px as they arrive. They stay fully visible throughout. */
function settleIn(root) {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.remove('nudge');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  for (const el of root.querySelectorAll('.agecard, .lvhead, .note, .grown h2')) {
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add('nudge');
      io.observe(el);
    }
  }
}

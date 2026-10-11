// Consistency checks that keep the project healthy as it grows. Run: npm run check
//  - every game in the registry has a file, and every game file is in the registry
//  - each game module follows the contract (docs/GAME-CONTRACT.md)
//  - src/activities/index.js is up to date
//  - levels, age guide and citations line up
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS, ACTIVITIES } from '../src/content/registry.js';
import { AGE_LEVELS, AGE_REFS, AGE_INTRO, AGE_CAVEAT } from '../src/content/age-guide.js';
import { generateIndex } from './gen-index.mjs';

const dir = fileURLToPath(new URL('../src/activities/', import.meta.url));
const problems = [];
// Games added from v1.5 on must offer talk-together prompts for the grown-up (docs/GAME-CONTRACT.md).
// The original 24 games are exempt until they are given prompts (see docs/BACKLOG.md).
const NO_TALK_YET = new Set([
  'same-or-more',
  'seats-for-everyone',
  'odd-one-out',
  'morning-order',
  'mirror-pegboard',
  'snowflakes',
  'missing-shape',
  'rope-rings',
  'ant-on-band',
  'pour-the-same',
  'dice-race',
  'build-from-picture',
  'which-room-larger',
  'squares-grow',
  'double-the-picture',
  'block-chains',
  'robot-walks',
  'construction-foreman',
  'tower-of-hanoi',
  'ways-to-make-5',
  'wolf-goat-cabbage',
  'necklaces',
  'shoes-in-dark',
  'wrong-labels',
]);
const fail = (msg) => problems.push(msg);

// registry
const ids = ACTIVITIES.map((a) => a.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) fail(`duplicate game ids in registry: ${dup.join(', ')}`);
const levelNs = LEVELS.map((l) => l.n);
for (const a of ACTIVITIES) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) fail(`${a.id}: id must be kebab-case`);
  if (!levelNs.includes(a.level)) fail(`${a.id}: level ${a.level} is not in LEVELS`);
  for (const k of ['title', 'emoji', 'blurb']) if (!a[k]) fail(`${a.id}: registry entry is missing "${k}"`);
}
for (const lv of LEVELS) if (!ACTIVITIES.some((a) => a.level === lv.n)) fail(`level ${lv.n} has no games`);

// files <-> registry
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'));
for (const f of files) if (!ids.includes(f.slice(0, -3))) fail(`${f} is not listed in src/content/registry.js`);

// game contract
for (const id of ids) {
  if (!files.includes(`${id}.js`)) {
    fail(`${id}: src/activities/${id}.js is missing`);
    continue;
  }
  const src = readFileSync(`${dir}${id}.js`, 'utf8');
  let mod;
  try {
    mod = (await import(`${dir}${id}.js`)).default;
  } catch (e) {
    fail(`${id}: module failed to load in Node: ${e.message}`);
    continue;
  }
  if (!mod || typeof mod !== 'object') {
    fail(`${id}: no default export`);
    continue;
  }
  if (mod.id !== id) fail(`${id}: default export id is "${mod.id}"`);
  if (typeof mod.start !== 'function') fail(`${id}: start(api) is missing`);
  if (!Number.isInteger(mod.rounds) || mod.rounds < 1) fail(`${id}: "rounds" must be a positive whole number`);
  if (typeof mod.parentNote !== 'string' || mod.parentNote.length < 40)
    fail(`${id}: parentNote is missing or too short`);
  const talk = mod.talkPrompts;
  if (talk !== undefined && !(Array.isArray(talk) && talk.every((q) => typeof q === 'string' && q.length > 5)))
    fail(`${id}: talkPrompts must be an array of short questions`);
  if (!NO_TALK_YET.has(id) && !(talk || []).length) fail(`${id}: new games (v1.5+) need talkPrompts`);
  if (!/^\/\*\*[\s\S]*?Game:/.test(src)) fail(`${id}: file must start with the standard /** Game: ... */ header`);
  if (!src.includes('api.setDemo(')) fail(`${id}: no Watch demo (api.setDemo)`);
  if (!src.includes('api.finish(')) fail(`${id}: never calls api.finish()`);
  if (!src.includes('resumeRound(')) fail(`${id}: does not use resumeRound(api, total) to honour saved progress`);
  if (/localStorage|sessionStorage/.test(src)) fail(`${id}: games must not use browser storage directly`);
  if (/\balert\(|\bfetch\(|https?:\/\//.test(src))
    fail(`${id}: no alert(), network requests or external URLs in games`);
  if (!src.includes(`.a-${id}`) && !src.includes('.a-${ID}') && !src.includes("'.a-' + ID"))
    fail(`${id}: CSS must be scoped with .a-${id}`);
}

// generated loaders
const idx = readFileSync(`${dir}index.js`, 'utf8');
if (idx !== generateIndex()) fail('src/activities/index.js is out of date: run `npm run build`');

// age guide
for (const lv of LEVELS) if (!AGE_LEVELS.some((x) => x.n === lv.n)) fail(`age guide has no entry for level ${lv.n}`);
const texts = [AGE_INTRO, AGE_CAVEAT, ...AGE_LEVELS.flatMap((l) => [l.text, ...l.games.map((g) => g[1])])];
for (const t of texts)
  for (const m of t.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g))
    for (const n of m[1].split(/,\s*/).map(Number))
      if (n < 1 || n > AGE_REFS.length) fail(`age guide cites [${n}] but there are ${AGE_REFS.length} references`);

// ---- recorded voice packs (docs/VOICE.md) ----
let voiceNote = 'no voice packs';
if (existsSync('audio/voice/plan.json')) {
  const plan = JSON.parse(readFileSync('audio/voice/plan.json', 'utf8'));
  let missing = 0;
  const noPack = [];
  for (const p of ['app', ...ids]) {
    const f = `audio/voice/${p}.bin`;
    if (!existsSync(f)) {
      noPack.push(p); // not an error: its lines use the browser voice until recorded (docs/VOICE.md)
      continue;
    }
    const b = readFileSync(f);
    const clips = JSON.parse(b.subarray(4, 4 + b.readUInt32LE(0)).toString('utf8')).clips || {};
    missing += (plan.packs[p] || []).filter((k) => !(k in clips)).length;
  }
  voiceNote =
    `voice packs ok (${Object.keys(plan.texts).length} sentences planned` +
    (missing ? `, ${missing} not yet recorded` : '') +
    (noPack.length ? `; no voice pack yet: ${noPack.join(', ')}` : '') +
    ')';
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `✓ ${ids.length} games, ${LEVELS.length} levels, ${AGE_REFS.length} age-guide references, ${voiceNote}: all consistent`,
);

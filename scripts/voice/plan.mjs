// Build the recording plan: which sentences each voice pack needs.
//   node scripts/voice/plan.mjs <say-log.jsonl ...>
// Inputs: logs of everything the site said during instrumented test runs and random play
// (see docs/VOICE.md), plus sentence-like string literals in each game file, its template lines filled in
// with the values seen (templates.mjs), plus the numbers 0-100.
// Output: audio/voice/plan.json  { packs: { <pack>: [key, ...] }, texts: { <key>: <sentence> } }
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { sentences, keyOf } from './text.mjs';
import { staticLines } from './static-lines.mjs';
import { expand } from './templates.mjs';
import { ACTIVITIES } from '../../src/content/registry.js';

const ids = new Set(ACTIVITIES.map((a) => a.id));
const packs = {};
const texts = {};
const logged = {};
const add = (pack, s) => {
  const k = keyOf(s);
  if (!k || !/[a-z0-9]/.test(k)) return;
  if (!(k in texts)) texts[k] = s;
  (packs[pack] ||= new Set()).add(k);
};

for (const f of process.argv.slice(2)) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const pack = ids.has(j.g) ? j.g : 'app';
    (logged[pack] ||= []).push(j.t);
    for (const s of sentences(j.t)) add(pack, s);
  }
}
for (const f of readdirSync('src/activities')) {
  const id = f.replace(/\.js$/, '');
  // Spoken lines are short; longer literals are grown-up notes, which are never read aloud.
  if (ids.has(id)) for (const s of staticLines(`src/activities/${f}`)) if (s.length <= 100) add(id, s);
  if (ids.has(id))
    for (const t of expand(`src/activities/${f}`, logged[id] || [])) for (const s of sentences(t)) add(id, s);
}
for (const s of staticLines('src/app/pages/play.js')) add('app', s);
for (let n = 0; n <= 100; n++) add('app', String(n));
for (let r = 1; r <= 5; r++) add('app', `Shall we carry on from round ${r}?`);

const out = { packs: {}, texts: {} };
for (const [p, set] of Object.entries(packs).sort()) out.packs[p] = [...set].sort();
const used = new Set(Object.values(out.packs).flat());
for (const k of [...used].sort()) out.texts[k] = texts[k];

// Keep keys already recorded (so a re-plan never loses a clip a pack still uses).
const prev = existsSync('audio/voice/plan.json') ? JSON.parse(readFileSync('audio/voice/plan.json', 'utf8')) : null;
writeFileSync('audio/voice/plan.json', JSON.stringify(out, null, 1) + '\n');
const chars = Object.values(out.texts).reduce((a, s) => a + s.length, 0);
console.log(`packs ${Object.keys(out.packs).length}, sentences ${used.size}, characters ${chars}`);
if (prev) console.log(`new since last plan: ${[...used].filter((k) => !(k in prev.texts)).length}`);

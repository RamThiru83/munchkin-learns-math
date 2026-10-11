// Fill in a game's template lines (`You go ${n} squares up!`) with every value seen in the logs,
// and for number slots every whole number between the smallest and largest seen, so that
// combinations random play never reached are recorded too.
import { EMOJI, sentences } from './text.mjs';
import { literals } from './static-lines.mjs';

const MAX_PER_TEMPLATE = 700;
const NUMS = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => String(lo + k));
const cartesian = (lists) => lists.reduce((acc, v) => acc.flatMap((c) => v.map((x) => [...c, x])), [[]]);
const fill = (clean, c) => {
  let s = clean[0];
  c.forEach((x, k) => (s += x + clean[k + 1]));
  return s.replace(/\s+/g, ' ').trim();
};
const WORDS = 'zero one two three four five six seven eight nine ten eleven twelve'.split(' ');

/** Template literals with 1-3 ${} slots in a source file: [{ parts: [text, text, ...] }]. */
export function templates(file) {
  return literals(file)
    .templates.filter((parts) => parts.length <= 4 && /[a-z]{2}/i.test(parts.join('')))
    .map((parts) => ({ parts }));
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** All fillings of the templates of one file, given the lines logged for that game. */
export function expand(file, logged) {
  const lines = logged.map((t) => String(t).replace(EMOJI, '').replace(/\s+/g, ' ').trim());
  const out = new Set();
  for (const { parts } of templates(file)) {
    const clean = parts.map((p) => p.replace(EMOJI, '').replace(/\s+/g, ' '));
    let src = esc(clean[0]);
    for (let k = 1; k < clean.length; k++) {
      const atEnd = k === clean.length - 1 && !clean[k].trim();
      src += (atEnd ? "([\\w'\u2019-]+)" : "([\\w'\u2019 -]*?)") + esc(clean[k]);
    }
    // A template must match a whole logged line, or one whole sentence of it (never a part of a sentence).
    const re = new RegExp('^' + src.trim() + '$');
    const slots = parts.slice(1).map(() => new Set());
    for (const l of lines) {
      const m =
        l.match(re) ||
        sentences(l)
          .map((x) => x.match(re))
          .find(Boolean);
      // A capture of three or more words is another, longer template's line ("2 make 8" for "# and #.").
      if (m && m.slice(1).every((v) => v.trim().split(' ').length <= 2)) m.slice(1).forEach((v, k) => slots[k].add(v));
    }
    // A slot that is mostly numbers is a number slot: drop the odd non-number captures (another template's
    // line, e.g. "3 and 4 make seven." matching "# and # make #.").
    for (const set of slots) {
      const v = [...set];
      const nums = v.filter((x) => /^\d+$/.test(x));
      if (nums.length && nums.length >= 0.8 * v.length) for (const x of v) if (!/^\d+$/.test(x)) set.delete(x);
    }
    let values;
    const numeric = (set) => [...set].every((x) => /^\d+$/.test(x));
    const seen = slots.map((set) => [...set]);
    if (slots.every((s) => !s.size)) {
      // Never seen in play: guess that the slots are small numbers.
      const text = parts.join('#');
      if (slots.length > 1 || !/^[A-Z#]/.test(text) || !/[.!?]$/.test(text) || /[<>{};=_|\\]/.test(text)) continue;
      values = [NUMS(0, 20)];
    } else if (slots.some((s) => !s.size)) continue;
    else if (slots.length === 3 && slots.every(numeric)) {
      // Three numbers: usually a sum ("3 and 4 make 7!"); record every small sum (or product) that fits the rule.
      const triples = lines
        .map(
          (l) =>
            l.match(re) ||
            sentences(l)
              .map((x) => x.match(re))
              .find(Boolean),
        )
        .filter(Boolean)
        .map((m) => m.slice(1).map(Number))
        .filter((t) => t.every((x) => Number.isInteger(x)));
      const rule = triples.every(([a, b, c]) => a + b === c)
        ? 'sum'
        : triples.every(([a, b, c]) => a * b === c)
          ? 'product'
          : null;
      if (!rule) {
        // No simple rule: keep only the exact triples that were heard (not every mix of the three).
        for (const c of triples.map((t) => t.map(String))) out.add(fill(clean, c));
        continue;
      } else {
        const combos3 = [];
        const top = Math.min(10, Math.max(6, ...triples.flatMap(([a, b]) => [a, b])) + 1);
        for (let a = 1; a <= top; a++)
          for (let b = 1; b <= top; b++) combos3.push([String(a), String(b), String(rule === 'sum' ? a + b : a * b)]);
        for (const c of combos3) out.add(fill(clean, c));
        for (const c of triples.map((t) => t.map(String))) out.add(fill(clean, c));
        continue;
      }
    } else
      values = slots.map((set) => {
        const v = [...set];
        if (numeric(set)) {
          const n = v.map(Number);
          // Widen to every small number: random play only ever sees some of them.
          // One slot: every number up to 20 (or the largest seen). Two slots: a little beyond what was seen
          // (dice stop at 6, counts at 10) so the packs stay small.
          const top =
            slots.length === 1 ? Math.max(20, ...n) : Math.max(...n) > 10 ? 20 : Math.min(10, Math.max(6, ...n) + 1);
          return NUMS(Math.min(0, ...n), Math.min(100, top));
        }
        if (v.every((x) => WORDS.includes(x.toLowerCase()))) {
          const n = v.map((x) => WORDS.indexOf(x.toLowerCase()));
          const cap = v.some((x) => /^[A-Z]/.test(x));
          return WORDS.slice(Math.min(...n), Math.max(...n) + 1).map((w) =>
            cap ? w[0].toUpperCase() + w.slice(1) : w,
          );
        }
        return v;
      });
    let combos = [[]];
    for (const v of values) combos = combos.flatMap((c) => v.map((x) => [...c, x]));
    if (slots.length === 2 && slots.every(numeric)) {
      // Keep only pairs that follow the relation every observed pair follows (a > b, a < b, a == b).
      const pairs = lines
        .map(
          (l) =>
            l.match(re) ||
            sentences(l)
              .map((x) => x.match(re))
              .find(Boolean),
        )
        .filter(Boolean)
        .map((m) => [Number(m[1]), Number(m[2])])
        .filter((t) => t.every((x) => Number.isInteger(x)));
      const rel = pairs.every(([a, b]) => a > b)
        ? 'gt'
        : pairs.every(([a, b]) => a < b)
          ? 'lt'
          : pairs.every(([a, b]) => a === b)
            ? 'eq'
            : null;
      if (rel) combos = combos.filter(([a, b]) => (rel === 'gt' ? +a > +b : rel === 'lt' ? +a < +b : +a === +b));
    }
    if (combos.length > MAX_PER_TEMPLATE) combos = seen.length ? cartesian(seen) : [];
    for (const c of combos) out.add(fill(clean, c));
  }
  return [...out];
}

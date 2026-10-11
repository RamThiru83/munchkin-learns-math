// Fill in a game's template lines (`You go ${n} squares up!`) with every value seen in the logs,
// and for number slots every whole number between the smallest and largest seen, so that
// combinations random play never reached are recorded too.
import { EMOJI } from './text.mjs';
import { literals } from './static-lines.mjs';

const MAX_PER_TEMPLATE = 400;
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
    const re = new RegExp(src.trim());
    const slots = parts.slice(1).map(() => new Set());
    for (const l of lines) {
      const m = l.match(re);
      if (m) m.slice(1).forEach((v, k) => slots[k].add(v));
    }
    let values;
    if (slots.every((s) => !s.size)) {
      // Never seen in play: guess that the slots are small numbers.
      const text = parts.join('#');
      if (slots.length > 1 || !/^[A-Z#]/.test(text) || !/[.!?]$/.test(text) || /[<>{};=_|\\]/.test(text)) continue;
      const top = slots.length === 1 ? 20 : 10;
      values = slots.map(() => Array.from({ length: top + 1 }, (_, k) => String(k)));
    } else if (slots.some((s) => !s.size)) continue;
    else
      values = slots.map((s) => {
        const v = [...s];
        if (v.every((x) => /^\d+$/.test(x))) {
          const n = v.map(Number);
          // Widen to every small number: random play only ever sees some of them.
          const lo = slots.length === 1 ? Math.min(0, ...n) : Math.min(...n);
          const hi = Math.min(100, Math.max(slots.length === 1 ? 20 : 0, ...n));
          return Array.from({ length: hi - lo + 1 }, (_, k) => String(lo + k));
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
    if (combos.length > MAX_PER_TEMPLATE) continue;
    for (const c of combos) {
      let s = clean[0];
      c.forEach((x, k) => (s += x + clean[k + 1]));
      out.add(s.replace(/\s+/g, ' ').trim());
    }
  }
  return [...out];
}

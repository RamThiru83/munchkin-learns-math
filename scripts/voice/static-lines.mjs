// String literals and template literals in a game file, found with a real JS parser (acorn, installed with ESLint).
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { sentences } from './text.mjs';

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((x) => walk(x, visit));
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}

/** { strings: [...], templates: [[text, text, ...], ...] } (template slots sit between the texts). */
export function literals(file) {
  const ast = parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  const strings = [];
  const templates = [];
  walk(ast, (n) => {
    if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value);
    if (n.type === 'TemplateLiteral') {
      const parts = n.quasis.map((q) => q.value.cooked ?? q.value.raw);
      if (parts.length === 1) strings.push(parts[0]);
      else templates.push(parts);
    }
  });
  return { strings, templates };
}

/** Sentence-like string literals (over-collects a little; that is fine). */
export function staticLines(file) {
  const out = new Set();
  for (const s of literals(file).strings) {
    if (!/^[A-Z0-9"'‘“][^<>{}=;#\\|_]*[.!?…]$/.test(s.trim())) continue;
    for (const x of sentences(s)) if (/[a-z]/i.test(x)) out.add(x);
  }
  return [...out];
}

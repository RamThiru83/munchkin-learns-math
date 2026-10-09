// Scaffold a new game:  npm run new-game -- <id> "<Title>" <level> <emoji>
// Creates src/activities/<id>.js from _template.js, adds it to the registry (end of its level) and regenerates the index.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [id, title = 'New Game', level = '1', emoji = '✨'] = process.argv.slice(2);
if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run new-game -- <kebab-case-id> "<Title>" <level> <emoji>');
  process.exit(1);
}
const p = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const file = p(`src/activities/${id}.js`);
if (existsSync(file)) throw new Error(`${file} already exists`);
writeFileSync(
  file,
  readFileSync(p('src/activities/_template.js'), 'utf8')
    .replaceAll('<id>', id)
    .replaceAll('<Title>', title)
    .replaceAll('<n>', level),
);

// Insert the registry entry after the last game of the same level.
const regPath = p('src/content/registry.js');
const reg = readFileSync(regPath, 'utf8').split('\n');
const entry = `  { id: '${id}', level: ${Number(level)}, title: '${title.replace(/'/g, "\\'")}', emoji: '${emoji}', blurb: 'TODO: one short line for the tile.' },`;
let at = -1;
reg.forEach((line, i) => {
  if (new RegExp(`level: ${Number(level)},`).test(line)) at = i;
});
if (at < 0) at = reg.findLastIndex((l) => l.trim() === '];') - 1;
reg.splice(at + 1, 0, entry);
writeFileSync(regPath, reg.join('\n'));
execFileSync('node', [p('scripts/gen-index.mjs')], { stdio: 'inherit' });
console.log(`Created src/activities/${id}.js and added it to the registry. Next: write the game, then npm run verify.`);

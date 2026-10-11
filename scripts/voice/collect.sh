#!/usr/bin/env bash
# Log every line the site says, for the voice plan (docs/VOICE.md).
# Makes an instrumented copy in ../mlm-voice-collect (speech is logged to the dev server and skipped),
# runs the whole test suite and random play there, and writes voice-logs/tests.jsonl and voice-logs/fuzz.jsonl.
#   bash scripts/voice/collect.sh            (CHROME=/path/to/chromium if Playwright's own is not installed)
set -euo pipefail
here="$(pwd)"; work="$here/../mlm-voice-collect"
rm -rf "$work"; mkdir -p "$work" voice-logs
cp -r src scripts tests package.json playwright.config.js "$work"/
ln -s "$here/node_modules" "$work/node_modules"
cd "$work"
python3 - <<'PY'
p='scripts/serve.mjs'; s=open(p).read()
s=s.replace("createServer(async (req, res) => {\n  try {","""import { appendFileSync } from 'node:fs';
createServer(async (req, res) => {
  if (req.url.startsWith('/__say')) {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { appendFileSync(process.env.SAYLOG, b + '\\n'); res.writeHead(204); res.end(); });
    return;
  }
  try {""",1)
open(p,'w').write(s)
p='src/lib/speech.js'; s=open(p).read()
s=s.replace("export async function say(text, { cancel = true } = {}) {","""export async function say(text) {
  if (text) {
    const m = location.hash.match(/#\\/play\\/([^?]+)/);
    fetch('/__say', { method: 'POST', body: JSON.stringify({ g: m ? m[1] : location.hash || '#/', t: String(text) }) }).catch(() => {});
  }
  return new Promise((r) => setTimeout(r, 40));
}
export async function sayUnused(text, { cancel = true } = {}) {""",1)
open(p,'w').write(s)
PY
SAYLOG="$here/voice-logs/tests.jsonl" TEST_PORT=8811 npx playwright test --reporter=dot || true
SAYLOG="$here/voice-logs/fuzz.jsonl" PORT=8812 node scripts/serve.mjs & srv=$!
sleep 1
node "$here/scripts/voice/fuzz.mjs" 8812 70 || true
kill $srv
echo "logs in voice-logs/"

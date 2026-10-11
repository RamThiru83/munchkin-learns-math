// Turn recorded clips into the voice packs the site loads.
//   node scripts/voice/pack.mjs <clips-dir>         -> audio/voice/<pack>.bin (one per game + app)
//   node scripts/voice/pack.mjs --todo [clips-dir]  -> voice-todo.json: sentences still to record (for chirp_gen.py)
// Clip file name = clipName(key) (see text.mjs).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { clipName } from './text.mjs';

const plan = JSON.parse(readFileSync('audio/voice/plan.json', 'utf8'));
const args = process.argv.slice(2);
if (args[0] === '--todo') {
  const dir = args[1];
  const items = {};
  for (const [k, s] of Object.entries(plan.texts)) {
    const n = clipName(k);
    if (!dir || !existsSync(`${dir}/${n}`)) items[n] = s;
  }
  writeFileSync('voice-todo.json', JSON.stringify({ voice: 'Achernar', rate: 0.9, items }) + '\n');
  console.log(
    `voice-todo.json: ${Object.keys(items).length} sentences, ${Object.values(items).join('').length} characters`,
  );
} else {
  const dir = args[0];
  let missing = 0;
  let bytes = 0;
  for (const [p, keys] of Object.entries(plan.packs)) {
    const index = {};
    const chunks = [];
    let off = 0;
    for (const k of keys) {
      const f = `${dir}/${clipName(k)}`;
      if (!existsSync(f)) {
        missing++;
        continue;
      }
      const b = readFileSync(f);
      index[k] = [off, b.length];
      chunks.push(b);
      off += b.length;
    }
    // Pack file: 4-byte little-endian header length, JSON header, then the MP3 clips back to back.
    const head = Buffer.from(JSON.stringify({ voice: 'en-US-Chirp3-HD-Achernar', rate: 0.9, clips: index }));
    const len = Buffer.alloc(4);
    len.writeUInt32LE(head.length);
    const body = Buffer.concat([len, head, ...chunks]);
    writeFileSync(`audio/voice/${p}.bin`, body);
    bytes += body.length;
  }
  console.log(
    `packs ${Object.keys(plan.packs).length}, total ${(bytes / 1e6).toFixed(1)} MB, sentences without a clip ${missing}`,
  );
}

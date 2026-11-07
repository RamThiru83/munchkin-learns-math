// Record the rhymes and songs (src/content/rhymes.js) in the narrator's voice and pack them (decision 0010).
//   GOOGLE_TTS_KEY=... node scripts/voice/songs.mjs record <clips-dir>   -> one trimmed MP3 per sentence
//   node scripts/voice/songs.mjs pack <clips-dir>                        -> audio/voice/songs.bin
//   node scripts/voice/songs.mjs list                                    -> sentences, and any without a clip
// Same voice as the rest of the site (Chirp 3 HD "Achernar"), a touch faster (rate 1.0) so the lines bounce.
// Recording needs ffmpeg (to trim silence). Clips already in the folder are kept, so re-running is safe.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sentences, keyOf, clipName } from './text.mjs';
import { RHYMES, SONGS } from '../../src/content/rhymes.js';

const RATE = 1.0;
const [cmd, dir = 'songs-clips'] = process.argv.slice(2);
const all = new Map(); // key -> sentence
for (const lines of [...Object.values(RHYMES), ...Object.values(SONGS)])
  for (const line of lines) for (const s of sentences(line)) all.set(keyOf(s), s);

if (cmd === 'list') {
  const missing = [...all.keys()].filter((k) => !existsSync(`${dir}/${clipName(k)}`));
  console.log(`${all.size} sentences, ${missing.length} without a clip in ${dir}`);
  missing.slice(0, 20).forEach((k) => console.log('  ' + all.get(k)));
} else if (cmd === 'record') {
  const key = process.env.GOOGLE_TTS_KEY;
  if (!key) throw new Error('Set GOOGLE_TTS_KEY (a Google Cloud API key with Text-to-Speech enabled).');
  mkdirSync(dir, { recursive: true });
  let made = 0;
  for (const [k, text] of all) {
    const out = `${dir}/${clipName(k)}`;
    if (existsSync(out)) continue;
    const body = {
      input: { text },
      voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Achernar' },
      audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000, speakingRate: RATE },
    };
    let res;
    for (let tries = 0; tries < 4; tries++) {
      res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 1500 * (tries + 1)));
    }
    if (!res.ok) throw new Error(`${res.status} for "${text}": ${(await res.text()).slice(0, 200)}`);
    const raw = `${dir}/_raw.mp3`;
    writeFileSync(raw, Buffer.from((await res.json()).audioContent, 'base64'));
    // trim silence as scripts/voice/trim.sh does
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '24000', '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,afade=t=in:d=0.02,areverse,afade=t=in:d=0.01,apad=pad_dur=0.06',
      '-c:a', 'libmp3lame', '-b:a', '32k', out,
    ]); // prettier-ignore
    made++;
  }
  console.log(`recorded ${made} new clips; ${all.size} sentences in all`);
} else if (cmd === 'pack') {
  const index = {};
  const chunks = [];
  let off = 0;
  for (const k of all.keys()) {
    const f = `${dir}/${clipName(k)}`;
    if (!existsSync(f)) throw new Error(`no clip for "${all.get(k)}" (run record first)`);
    const b = readFileSync(f);
    index[k] = [off, b.length];
    chunks.push(b);
    off += b.length;
  }
  const head = Buffer.from(JSON.stringify({ voice: 'en-US-Chirp3-HD-Achernar', rate: RATE, clips: index }));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  writeFileSync('audio/voice/songs.bin', Buffer.concat([len, head, ...chunks]));
  console.log(`audio/voice/songs.bin: ${all.size} sentences, ${(off / 1e3).toFixed(0)} KB`);
} else {
  console.log('usage: node scripts/voice/songs.mjs record|pack|list [clips-dir]');
}

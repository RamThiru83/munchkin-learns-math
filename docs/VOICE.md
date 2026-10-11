# The recorded voice

Since v1.6 the site speaks with a recorded voice: Google Cloud Text-to-Speech **Chirp 3 HD "Achernar"** at speaking
rate 0.9, the same narrator voice as the Little Scientists Club videos. Every sentence the site can say is recorded once
and shipped as small voice packs. If a line has a sentence with no recording (for example a new game, or a rare
number combination), the whole line falls back to the browser's own speech voice, so nothing ever goes silent.

## How it works

- `src/lib/speech.js` splits each line into sentences (`sentences()`), looks each one up by `keyOf()` in the loaded
  packs and plays the clips one after another with Web Audio. Rules are shared with `scripts/voice/text.mjs`: keep
  the two in step.
- Packs: `audio/voice/app.bin` (app shell lines and the numbers 0–100) and `audio/voice/<game id>.bin`: a 4-byte
  little-endian header length, a JSON header `{ voice, rate, clips: { <key>: [offset, length] } }`, then the MP3
  clips back to back. The play page loads `app` and the game's pack when a game opens.
- `audio/voice/plan.json` lists, per pack, the sentence keys it needs and the text of every sentence.
- Browsers only allow sound after a tap; the first tap wakes the audio. A line spoken before any tap (opening a game
  link directly) uses the browser voice.
- `<html data-voice="recorded|browser">` shows which voice spoke last (used by `tests/voice.spec.js`).
- `npm run check` reports how many planned sentences have no recording yet.

## Recording new or changed lines (after adding a game or changing wording)

1. Collect what the site says. Make an instrumented copy and log every line during the full test suite and random
   play (`scripts/voice/collect.sh` does all of this; about 40 minutes on a 2-core machine):
   `bash scripts/voice/collect.sh` → `voice-logs/*.jsonl`
2. Plan: `node scripts/voice/plan.mjs voice-logs/*.jsonl` → `audio/voice/plan.json` (also adds sentence-like string
   literals from each game file, its template lines filled in with the values seen, and the numbers 0–100).
3. What still needs recording: `node scripts/voice/pack.mjs --todo <folder of existing clips>` → `voice-todo.json`.
4. Record in Google Cloud Shell (project `little-scientists-511103`, Text-to-Speech API enabled): upload
   `scripts/voice/chirp_gen.py` and `voice-todo.json` (Cloud Shell menu ⋮ → Upload), run
   `nohup python3 chirp_gen.py voice-todo.json > gen.log 2>&1 &` (safe to re-run; if the count of files in
   `clips/` stops growing, kill it and start it again), then ⋮ → Download `voice_clips.zip`.
   Check: upload `scripts/voice/asr_check.py`, `pip install --user -q faster-whisper imageio-ffmpeg`, run
   `python3 asr_check.py voice-todo.json` and look at the flagged clips (about 25 clips a minute on Cloud Shell).
5. Trim and pack: `bash scripts/voice/trim.sh voice_clips.zip <clips folder>` (trims leading/trailing silence) then
   `node scripts/voice/pack.mjs <clips folder>` → `audio/voice/*.bin`.
6. `npm run verify`, listen to a few lines, commit `audio/voice/` with the code.

The master copy of the recordings (untrimmed clips from Cloud Shell, named by `clipName()`) is kept in the Mac folder
"Munchkin Learns Math - site/voice-recordings/" (for v1.6.0: `chirp3hd-achernar_raw-clips_20261011.zip`). To re-pack
without re-recording: `bash scripts/voice/trim.sh <that zip> <clips folder>` then `node scripts/voice/pack.mjs <clips folder>`.

## Quality checks done (Oct 2026)

- Coverage: lines logged in a separate random-play run that was not used for planning: 94.9% were fully recorded;
  the rest (rare number combinations) used the browser voice.
- Speech-recognition check (Whisper base.en on the untrimmed clips): all 1,824 sentences heard in tests and play,
  plus a random 300 of the rest. After allowing for homophones and spelling ("two"/"to", "colour"/"color"),
  50 of 1,824 (2.7%) still differed. All are very short lines where the recogniser confused similar words
  ("Wow"/"Whoa", "Peek"/"Pick", "Owl rolled 3"/"Our world 3"); no transcript suggested a cut-off ending or a missing word. Worth a listen
  by ear: the "Owl rolled …" lines (Number Path Race) and "Is the flipped one new?" (Necklaces).
  In the random sample, 24 of 300 were flagged on the first pass, all of the same homophone kind.

## Cost

About 5,600 sentences, ~115,000 characters in total. Google's price list (checked 11 Oct 2026,
https://cloud.google.com/text-to-speech/pricing) gives Chirp 3 HD voices 1 million free characters a month, then
US$30 per million: a full re-recording is about 12% of the free allowance (about US$3.50 if billed).

# 0007 — Recorded voice in separate packs, browser speech as fallback

**Status:** accepted (Oct 2026). Refines [0002](0002-single-file-build.md).

**Context.** Browser speech sounds different on every device and is often robotic. The family's Little Scientists
Club videos use Google's Chirp 3 HD "Achernar" voice, and the site should sound the same. Recording every line is
~45 MB of MP3: far too big to inline into `index.html`.

**Decision.**
- Every sentence the site can say is pre-recorded once (scripts in `scripts/voice/`, guide in [../VOICE.md](../VOICE.md))
  and stored in one pack per game plus one for the app (`audio/voice/*.bin`), loaded only when that game opens.
- These same-site files are the only network requests the site makes. No third-party service is called at run time,
  and nothing is sent: packs are read-only files next to `index.html`.
- If a pack is missing, cannot load (e.g. `index.html` opened from disk), or a line has a sentence that was never
  recorded, the whole line is spoken by the browser's speech voice, as before. `index.html` alone still works.

**Consequences.** Changing or adding spoken wording means recording the new sentences (Cloud Shell step) and
re-packing, or those lines fall back to the browser voice; `npm run check` reports how many are unrecorded. The
repository grows by ~45 MB per full re-recording (git keeps old versions), so re-record only what changed.

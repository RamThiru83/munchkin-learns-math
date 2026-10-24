# Changelog

Versions follow [semantic versioning](https://semver.org/): patch = fixes, minor = new games or features, major = changes to saved data or the game contract.

## 1.7.0 — 2026-10-24

A new look for everything around the games, made for the child who plays (decisions 0008 and 0009); the games themselves are unchanged.

- **Home, pictures first:** the first screen is one big picture of the game to play next with a pulsing play button (or "Carry on" with the round reached), her stars and games played below. "Pick a level" shows five large picture buttons (seed, sprout, bud, blossom, fruit). Each level is a full-colour chapter; every game tile leads with a picture of its real first round, its name and its stars.
- **Level bar:** the five levels stay at the top while scrolling, each with its drawing, and take the colour of the level on screen.
- **Game frame:** the game's name is the page heading; picture-and-word buttons at least 56px tall (Home, Watch, Talk, Again, Voice on/off); a larger "Hear it again" button; calmer banner and progress dots.
- **Finish card:** the next game's picture is the main button, with Play again and Home below. The welcome-back card's buttons have pictures too.
- **Grown-up controls are quiet:** Voice, Sound and the grown-ups guide are small icon buttons in the top corner (and in the footer).
- **Type:** Andika, a typeface made for beginning readers (single-storey a and g), embedded; sentence case everywhere; body text 18–20px.
- **Accessibility:** one heading and main landmark per page, focus moves to the chapter or the finish card, screen-reader names on every button; automated WCAG 2.1 AA check passes with no issues.
- **Grown-ups page, short:** four tips, the five age bands in one row of cards, and each game in one line with one question to ask. The full notes, the research behind the ages and the references open under "More". The grown-ups block on the home page is two sentences.
- Maintenance: `scripts/shots.mjs` and `scripts/shots-small.py` make the game pictures in `img/games/`.

## 1.6.1 — 2026-10-11

Audit of all 30 games after the recorded voice went live (lags, voice skips, incoherent lines):

- **No more self-interruptions:** every line a game speaks on its own (round intros, cheers before the next round, Watch demos, counting aloud in animations) now waits for the previous line to finish; the old character-count timeouts that cut the recorded voice short are gone. A child's own tap may still interrupt a line.
- **Less waiting:** input is never locked while a line plays (except in Watch demos); fixed pauses after cheers are shorter; the game and its voice pack load together (no 1.5 s wait on the first lines, no mixed voices at the start); the next game's pack is fetched in the background.
- **Coherent lines:** grammar slips ("1 are showing"), lines that did not match the screen, cheers repeated many times in a row, two fixed bugs from the backlog (Wolf, Goat and Cabbage "boat is back" line; Builder Team turn counter), Builder Team/Necklaces/Snowflakes/Same or More timing and wording fixes.
- **Voice:** 1,800 more sentences recorded (number combinations that random play had not reached: dice sums, comparisons, "N comes before M", Double the Picture directions); clips with chopped endings re-recorded; all clips get a short fade-out. With the voice off, lines now take reading time so games pace the same way.
- Maintenance: `VOICE=1 npm test` plays the games with the voice on; `?voicelog` troubleshooting log; games may export `_voiceLines`; `scripts/voice/chirp_gen.py` retries abrupt endings.

## 1.6.0 — 2026-10-11

- **Recorded voice:** every game now speaks with Google's Chirp 3 HD "Achernar" voice, the same narrator as the Little Scientists Club videos, instead of the device's robotic speech. About 5,600 sentences were recorded once and ship as one voice pack per game (`audio/voice/`), loaded when the game opens. Any line that was not recorded, or a device that cannot play the packs, uses the browser voice as before.
- On iPhone/iPad the voice plays even with the silent switch on (Safari 16.4+).
- New: `docs/VOICE.md`, `scripts/voice/` (collect, plan, record in Cloud Shell, speech-recognition check, pack), decision record 0007, `tests/voice.spec.js`. Tests now run with the voice off except the voice test.

## 1.5.0 — 2026-10-10

Six new games from the research-based plan (see the "New games plan" report), bringing the total to 30:

- **Number Path Race** (level 1): hop along a straight 1–20 number path, counting on; place numbers on an empty line.
- **Quick Peek** (level 1): see small amounts at a glance; five- and ten-frames; how many more make 10.
- **Hidden Beads** (level 2): part–whole — how many beads hide under the cup; number bonds to 10.
- **What Does Teddy See?** (level 2): another person's view, position words and a simple map.
- **Equal Towers & Bars** (level 3): compare and combine within 10, from blocks to pictures to bars.
- **Tower to the Mark** (level 3): measuring with blocks and clips; bigger units give smaller numbers.

Also: a **💬 Talk** button in the game bar shows short questions for the grown-up (required for new games); the For grown-ups page shows them and the age guide covers the new games (13 new checked references, 35 in all). Each new game has smoke, resume and full play-through tests.

## 1.4.0 — 2026-10-08

Maintenance release: no change to how the games play.

- Source code now lives in the GitHub repo (`src/`), with docs, tests and a build script, instead of only a zip.
- App shell split into small modules (router, pages, saved progress, shared UI); helpers split into focused `src/lib/` modules.
- Saved progress is versioned (`schema` key) with a migration table, so future updates keep children's stars.
- Every game follows a written contract (header, `rounds`, `resumeRound`), checked by `npm run check`.
- New tests: smoke and resume for every game at desktop and phone size, plus a full play-through of every game.
- `npm run new-game` scaffold, ESLint, Prettier, GitHub Actions CI.
- Version number shown on the For grown-ups page.

## 1.3.0 — 2026-10-05

- Progress is saved after every round; a game reopened part-way offers "Carry on from round N" or "Start from round 1".
- The home map shows "▶ Round N of 5" on games in progress. "↻ Again" restarts only the current round.

## 1.2.0 — 2026-10-04

- Every game grows from 3 to 5 rounds.
- For grown-ups: research-based age guide per level with 22 checked references.
- Wolf, Goat and Cabbage hints made progressive.

## 1.1.0 — 2026-10-02

- Renamed to "Munchkin Learns Math"; repo renamed; full book citation on the home page, grown-ups page and README.

## 1.0.0 — 2026-10-02

- First release: 24 games across five levels, Watch demos, voice read-aloud, single-file build on GitHub Pages.

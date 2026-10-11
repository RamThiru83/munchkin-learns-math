# Changelog

Versions follow [semantic versioning](https://semver.org/): patch = fixes, minor = new games or features, major = changes to saved data or the game contract.

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

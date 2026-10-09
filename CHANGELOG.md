# Changelog

Versions follow [semantic versioning](https://semver.org/): patch = fixes, minor = new games or features, major = changes to saved data or the game contract.

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

# 0005 — One file per game behind a small contract

**Status:** accepted (Oct 2026)

**Decision.** Each game is `src/activities/<id>.js` exporting `{ id, rounds, parentNote, start(api) }` and importing only `src/lib/core.js`. The shell provides banner, progress dots, Watch button, saved rounds and the celebration. The rules are in [../GAME-CONTRACT.md](../GAME-CONTRACT.md) and checked by `npm run check`.

**Consequences.** Games can be added, rewritten or removed without touching others. Shared behaviour (e.g. resume) is added once in the shell plus a small change per game. Long game files are acceptable; keep the header comment accurate.

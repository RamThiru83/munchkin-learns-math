# Architecture

A static site with no runtime dependencies: plain JavaScript modules, a hash router, and one file per game. A build step bundles everything into a single `index.html` that GitHub Pages serves.

## Request flow

```
index.html (built)  or  src/index.html (dev)
  └─ src/app/main.js           hash router: #/ · #/play/<id> · #/grownups
       ├─ pages/home.js        map of levels and tiles (reads content/registry.js, app/progress.js)
       ├─ pages/play.js        frame around one game: bar, owl banner, stage, dots
       │     └─ activities/index.js → activities/<id>.js   (lazy import; bundled in the build)
       └─ pages/grownups.js    tips, age guide (content/age-guide.js), each game's parentNote, references
```

## Layers and what may import what

| Layer | Folder | May import |
|---|---|---|
| Shell | `src/app/` | `lib/`, `content/`, `activities/index.js` |
| Games | `src/activities/` | **only** `src/lib/core.js` (plus pure data they define themselves) |
| Helpers | `src/lib/` | other `lib/` modules |
| Content | `src/content/` | nothing (pure data) |

Games never touch storage, the router or other games. They talk to the shell only through the `api` object (see [GAME-CONTRACT.md](GAME-CONTRACT.md)). This is what lets games be added, rewritten or removed independently.

## Saved data (`src/app/progress.js`)

localStorage keys (prefixed `nilaa:`): `schema`, `progress` (stars per game), `resume` (round a child is on), `sound`, `voice`. The shape is versioned (`SCHEMA`) with a migration table, and game renames are handled with `RENAMED_IDS`. See [decisions/0004](decisions/0004-saved-progress.md).

## Build (`scripts/build.mjs`)

1. `gen-index.mjs` writes `src/activities/index.js` from the registry (static `import()` paths so esbuild can bundle them).
2. esbuild bundles `src/app/main.js` into one minified script (target ES2020) and stamps the version from `package.json`.
3. The CSS files listed in `src/index.html` and the script are inlined into `index.html` at the repo root.

The build is reproducible (no dates), so CI can rebuild and confirm the committed `index.html` matches the source.

## Quality gates

- `npm run check` — structural rules (registry ↔ files, contract fields, header comment, no storage/network in games, index up to date, age-guide citations).
- `npm run lint` — ESLint for real bugs; `npm run format:check` — Prettier.
- `npm test` — Playwright smoke + resume for every game at desktop and phone size.
- `npm run test:playthrough` — every game played to the finish card.
- GitHub Actions (`.github/workflows/ci.yml`) runs all of the above on every push.

## Browser support

Evergreen browsers from 2020 on (Chrome/Edge, Safari 14+, Firefox). Uses ES2020, pointer events, WebAudio, `speechSynthesis` (optional: the game still works without voice), CSS grid and `dvh` units.

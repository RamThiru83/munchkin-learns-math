# Maintenance guide

Written for whoever picks this up next — you in a year, or a new Claude session. Read this first.

## Where things live

| What | Where |
|---|---|
| Source of truth | GitHub repo `RamThiru83/munchkin-learns-math` (branch `main`) |
| Live site | GitHub Pages, served from the repo root of `main`: https://ramthiru83.github.io/munchkin-learns-math/ |
| Offline copy | "Munchkin Learns Math - site" folder on Ram's Mac (full source + built `index.html`) |
| Children's progress | Each browser's localStorage (not on any server) |

A Claude cloud workspace is temporary. Never treat a copy there as the master: always start from the GitHub repo and push back to it.

## Making a change

```sh
git clone https://github.com/RamThiru83/munchkin-learns-math.git
cd munchkin-learns-math
npm install
npx playwright install chromium   # first time only
npm run dev                       # edit src/, refresh http://localhost:8765/src/
```

Then release:

1. Bump `version` in `package.json`: patch (1.4.1) for fixes, minor (1.5.0) for new games/features, major (2.0.0) for anything that changes saved data or the game contract.
2. Add an entry at the top of `CHANGELOG.md`.
3. `npm run verify` (check + lint + build + tests) and `npm run test:playthrough`. All must pass.
4. Commit **both** the source changes and the rebuilt `index.html`, and push to `main`. GitHub Pages redeploys in a minute or two; CI re-runs every check on GitHub.
5. Open the live site with `?v=<new version>` added to the address to skip the cache, and check the version on the For grown-ups page.
6. Refresh the Mac copy (`git pull` in that folder, or copy the repo).

No local git credentials? Use GitHub's web upload ("Add file → Upload files") into the matching folder, one folder per commit, after running the checks locally.

## Never change without a plan

- The localStorage prefix `nilaa:` and the keys in `src/app/progress.js` — changing them erases every child's stars. Shape changes need a `SCHEMA` bump and a migration.
- Existing game ids — saved progress is stored under them. Use `RENAMED_IDS`.
- The single-file build — the site must keep working as one `index.html` with no network requests.

## Routine upkeep (about once a year)

- `npm outdated`, then update dev dependencies one at a time (`npm i -D --save-exact <pkg>@latest`) and run `npm run verify` after each. They are build/test tools only; the site itself has no dependencies.
- Check the site on a current iPhone/iPad (Safari) and an Android phone: voice, drag and drop, layout.
- Check the GitHub Actions run is green on `main`.
- Every two years or so, glance at the age guide sources for newer evidence ([AGE-GUIDE-SOURCES.md](AGE-GUIDE-SOURCES.md)).

## When a test fails

- **`npm run check`** prints exactly what is inconsistent (missing file, registry entry, contract field, stale index).
- **Smoke/resume** failures usually mean a game throws an error or its Watch demo no longer finishes. Look at the screenshot under `test-results/`.
- **Play-through** failures after a markup change in a game: each spec's header lists the selectors it relies on; update the spec along with the game.
- Tests are timing-sensitive on a heavily loaded machine (Chromium "Target crashed"). Re-run with fewer workers: `npx playwright test --workers=1`.

## Version history and decisions

See [../CHANGELOG.md](../CHANGELOG.md) and [decisions/](decisions/). Known issues and ideas: [BACKLOG.md](BACKLOG.md).

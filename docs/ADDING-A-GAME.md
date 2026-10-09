# Adding a game

1. **Pick the idea and level.** Check [CONTENT-GUIDE.md](CONTENT-GUIDE.md). Decide where it sits in difficulty; games are numbered by their position in `src/content/registry.js`.
2. **Scaffold it:**
   ```sh
   npm run new-game -- shape-hunt "Shape Hunt" 2 "🔺"
   ```
   This copies `src/activities/_template.js` to `src/activities/shape-hunt.js`, adds a registry entry after the last game of level 2 (edit its `blurb`, and move the line if it belongs earlier), and regenerates `src/activities/index.js`.
3. **Write the game** following [GAME-CONTRACT.md](GAME-CONTRACT.md): header comment, 5 rounds, `resumeRound`, Watch demo, gentle hints, `api.finish()`. Run `npm run dev` and open `http://localhost:8765/src/#/play/shape-hunt`.
4. **Verify the maths.** Brute-force any puzzle generator in Node (export a `_test` object if useful).
5. **Add a play-through test** `tests/playthrough/shape-hunt.spec.js` (copy a simple one such as `which-room-larger.spec.js`). It must pass three times in a row:
   ```sh
   npx playwright test tests/playthrough/shape-hunt.spec.js --project=desktop --repeat-each=3
   ```
6. **Grown-ups page.** The `parentNote` appears automatically. If the game changes what a level covers, update that level in `src/content/age-guide.js` (with a checked source; see [AGE-GUIDE-SOURCES.md](AGE-GUIDE-SOURCES.md)).
7. **Release:** bump the version in `package.json` (minor for a new game), add a CHANGELOG entry, run `npm run verify`, then publish ([MAINTENANCE.md](MAINTENANCE.md)).

## Adding a level

Add it to `LEVELS` in `registry.js`, give it an entry in `src/content/age-guide.js`, and add a colour class `.lvN` in `src/styles/home.css`. `npm run check` will tell you if any piece is missing.

## Removing or renaming a game

- **Rename:** never just change the id. Rename the file and registry entry, then add `'old-id': 'new-id'` to `RENAMED_IDS` in `src/app/progress.js` so saved stars follow it.
- **Remove:** delete the file and registry entry. Old saved stars stay in storage harmlessly.

# Munchkin Learns Math

Gentle, interactive maths games for little learners (about ages 4–7, played with a grown-up), ordered from easy to tricky across five levels: Seeds, Sprouts, Buds, Blossoms and Fruits.

**Live site:** https://ramthiru83.github.io/munchkin-learns-math/

- 24 original games, each with five rounds that get a little harder each time.
- Every game has a **Watch** button that plays a narrated demonstration of the task.
- Voice read-aloud (browser speech), soft sounds, no scores to lose, no timers.
- Progress is saved on the device after every round; a child can carry on from the same round next time.
- The **For grown-ups** page has notes for each game and a research-based age guide for each level (22 checked references).
- No sign-in, no tracking, no network requests: the whole site is one self-contained `index.html`.

The games are inspired by the preschool maths-circle activities described in the book below. This is an independent project, not affiliated with the author or publisher; all games, drawings and wording are original.

**Reference:** Zvonkin, A. (2011). *Math from Three to Seven: The Story of a Mathematical Circle for Preschoolers*. Mathematical Circles Library, Vol. 5. Providence, RI: American Mathematical Society, in cooperation with the Mathematical Sciences Research Institute (MSRI). ISBN 978-0-8218-6873-7.

## Working on the code

Needs Node.js 20 or newer.

```sh
npm install            # once
npm run dev            # http://localhost:8765/src/  (live source)  and  http://localhost:8765/  (built site)
npm run verify         # check + lint + build + all browser tests: run before every publish
```

| Command | What it does |
|---|---|
| `npm run dev` | Serves the project locally. |
| `npm run build` | Regenerates the game index and writes the single-file site to `index.html`. |
| `npm run check` | Project consistency: registry ↔ files, game contract, age-guide citations. |
| `npm run lint` / `npm run format` | ESLint (bugs) / Prettier (formatting). |
| `npm test` | Every game at desktop and phone size: smoke (loads, Watch demo) and resume (saved rounds). |
| `npm run test:playthrough` | Plays every game through all five rounds, like a child would. |
| `npm run new-game -- <id> "<Title>" <level> <emoji>` | Scaffolds a new game from the template. |

First time running the tests: `npx playwright install chromium`.

## Project layout

```
index.html              BUILT site, served by GitHub Pages. Generated: never edit by hand.
src/
  index.html            development entry (ES modules)
  app/                  the shell: router (main.js), pages/, saved progress, shared UI
  lib/                  helpers games may use (core.js re-exports them all)
  content/              data: levels and games (registry.js), age guide, book citation
  activities/           one file per game + _template.js; index.js is generated
  styles/               base, home, play, games, grown-ups CSS
scripts/                build, serve, check, gen-index, new-game
tests/                  Playwright: smoke, resume, playthrough/<game>
docs/                   how it works and how to maintain it
```

## Documentation

- [docs/MAINTENANCE.md](docs/MAINTENANCE.md) — publishing, routine upkeep, what never to change. **Start here.**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together.
- [docs/GAME-CONTRACT.md](docs/GAME-CONTRACT.md) — the rules every game follows.
- [docs/ADDING-A-GAME.md](docs/ADDING-A-GAME.md) — step by step.
- [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md) — tone, audience, accessibility, originality.
- [docs/AGE-GUIDE-SOURCES.md](docs/AGE-GUIDE-SOURCES.md) — how the age bands were sourced and checked.
- [docs/BACKLOG.md](docs/BACKLOG.md) — known issues and ideas.
- [docs/decisions/](docs/decisions/) — why things are the way they are.
- [CHANGELOG.md](CHANGELOG.md) — what changed in each version.

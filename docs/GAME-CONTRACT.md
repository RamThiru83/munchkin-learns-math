# The game contract

Every game is one file, `src/activities/<id>.js`. The app loads it only when needed and gives it a
container to draw into plus an `api` object. `npm run check` enforces the rules marked ✔︎.

## Shape of a game module

```js
/**
 * Game: Dice Race  (id: dice-race, level 3)
 *
 * Idea: some totals of two dice come up more often than others (there are more ways to make them).
 * Rounds:
 *   1. ...
 *   5. ...
 * Watch demo: ...
 * Notes: anything a future maintainer must know (fragile layout, test hooks, verified puzzle counts).
 */
import { h, sleep, resumeRound } from '../lib/core.js';

const ID = 'dice-race';
const ROUNDS = [ /* round data */ ];

export default {
  id: ID,                        // ✔︎ equals the file name and the registry id
  rounds: ROUNDS.length,         // ✔︎ number of rounds (currently 5 for every game)
  parentNote: '…',               // ✔︎ 2–3 sentences shown on the For grown-ups page
  async start(api) {             // ✔︎
    let alive = true;            // set false in destroy(); check after every await
    let round = resumeRound(api, ROUNDS.length); // ✔︎ start on the saved round
    api.css(CSS);                // ✔︎ scoped under .a-<id>
    ...
    api.setDemo(async () => { … });   // ✔︎ Watch button
    ...
    return { destroy() { alive = false; /* clear timers, cancel animation frames */ } };
  },
};
```

✔︎ The file starts with the `/** Game: … */` header comment.

## The `api` object

| Member | What it does |
|---|---|
| `api.root` | The stage element (empty flex column) to draw into. |
| `api.prompt(text)` | Show and speak the instruction (≤ 12 simple words). Returns a promise that resolves when speech ends. |
| `api.cheer(text)` | Positive banner + chime + speech. |
| `api.nudge(text)` | Gentle "try again" banner + soft sound + speech. Never "wrong!". |
| `api.stage(i, n)` | Call at the start of each round: shows progress dots and **saves the round** so the child can resume. The first call must be for the starting round (never call `stage(0, …)` before a resumed round). |
| `api.resume` | Zero-based round to start on (0 = fresh start). Read it through `resumeRound(api, total)`. |
| `api.setDemo(fn)` | Registers the Watch demo: an async function that animates a correct solution of the **current** round and leaves the child on that round. |
| `api.finish()` | Call once after the last round: clears the saved round, awards stars, shows the celebration. |
| `api.css(text)` | Adds a `<style>` that is removed when the game closes. Prefix every selector with `.a-<id>`. |
| `api.meta` | The game's registry entry (`id`, `title`, `level`, …). |
| everything in `lib/core.js` | `h`, `sleep`, `rand`, `pick`, `shuffle`, `range`, `drag`, `flyTo`, `glideBack`, `sfx`, `say`, `confetti`, `COLORS`, `settings`, `resumeRound` … |

## Rules

- Games import only from `../lib/core.js`. Need a new shared helper? Add it to a focused module in `src/lib/` and re-export it from `core.js`.
- ✔︎ No `localStorage`, network requests, external URLs or `alert()` in games. The app owns saved progress.
- 5 rounds of increasing difficulty: round 1 very easy, the last round a real challenge for a capable 6–7-year-old.
- No timers, scores to lose, red crosses or scary themes. Wrong moves bounce back with a hint; after 2 misses in a row give a stronger hint (`.glow`). Never a dead end.
- Big touch targets (≥ 56 px where possible). Must work from 360 px phone width to desktop with no sideways scrolling.
- Mathematical correctness: verify puzzles and answers (a quick Node brute-force check is ideal; keep it as an exported `_test` object or a test if it is reusable).
- Original content only: no text copied from the book, no real children's names.
- Respect that sound and voice may be off: the banner text must always carry the instruction.
- `npm run verify` must pass before publishing.

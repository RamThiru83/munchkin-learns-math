# 0011 — Every game fits on one screen

Status: accepted (2026-11-07).

## Context

Ram (7 Nov): "For certain games, the whole game is not captured on the screen, needing scrolling. This is not intuitive for kids. Shrink all the parts of the game to the same screen dimensions. Optimised for a 10 inch iPad Pro screen." On a 10.5-inch iPad Pro held sideways (1112 × 834 CSS px) the game area is about 1112 × 646 px; The Ant on the Band needed 889 px and Mirror Pegboard 663 px, and later rounds of other games can grow.

## Decision

- The game draws into a `.fit` box inside the stage (`api.root`). `src/lib/fit.js` watches the stage and the game (ResizeObserver + MutationObserver) and, when the game is taller or wider than the stage, scales `.fit` down with a CSS transform (origin top centre) so all of it is visible; it is never scaled up. A negative bottom margin shrinks the layout box with it, so no scroll bar appears. Below 50 % the game would be too small to tap, so the stage scrolls instead (not reached on the iPad).
- Pointer code converts screen pixels to the game's own pixels with `scaleOf(el)` and `fixedAt(el, x, y)` (re-exported by core.js): `drag()`/`flyTo()` in lib/drag.js, and the games with their own drag, drop or slide animations (block-chains, build-from-picture, missing-shape, necklaces, number-path-race, robot-walks, shoes-in-dark, snowflakes, tower-of-hanoi, wolf-goat-cabbage). Hit tests use `elementFromPoint` or rectangle fractions, which already work under a transform.
- Tests: `FITSCALE=0.72 npm test` draws every game at 72 % to check the pointer maths; `IPAD=1 npm test` adds the 10.5-inch iPad Pro in both orientations.

## Consequences

Games whose content is taller than the screen look a little smaller instead of needing a scroll. New games must convert screen-pixel deltas with `scaleOf()` when they move elements by pointer distance (docs/GAME-CONTRACT.md).

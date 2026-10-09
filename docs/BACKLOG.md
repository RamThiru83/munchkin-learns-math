# Backlog

Known issues and ideas, roughly by priority. Move items to CHANGELOG.md when done.

## Known bugs (found during the 1.4.0 tidy, left unfixed to keep that release behaviour-neutral)

- **Wolf, Goat and Cabbage:** in `sail()`, `state.boat === 0 && history.length === 1` can never be true, so the line "The boat is back. Who goes next?" never plays (probably meant `history.length === 2`). Marked `TODO(bug)` in the file.
- **Builder Team (construction-foreman):** `turnText` is created but never added to the SVG, so "Turn n" / "Done in n turns!" never show in the scene. Marked `TODO(bug)`.

## Usability

- Some touch targets are below 56 px on a 360 px phone: Dice Race 6×6 grid (~50 px), Make It Twice as Big 9×9 grid (~33 px), small triangles in Build the Picture with 8 pieces, round-5 pair tags in All the Labels Are Wrong.
- On small phones a few round 4–5 screens need a little vertical scrolling (Robot Walks long programs, Make It Twice as Big buttons, A Day in Order 8 cards, Fold Cut Unfold).
- Dice Race round 5 uses real random rolls, so the child's team can lose; the game says so kindly and still counts the round.
- Tested in headless Chromium only; test on real iPhone/iPad Safari and Android.

## Code health

- Two games use CSS prefixes that differ from their id (`.a-seats` in seats-for-everyone); harmless, but could be aligned.
- Several play-through tests depend on specific selectors or prompt wording (listed in each spec header).

## Ideas

- Export / import progress (a small code or file) so stars survive a browser reset or move to a new device.
- More levels or games from the book; a "free play" mode with random rounds.
- Optional Tamil/Hindi voice and text (would need a strings file per language).
- Choose a licence for the repository (currently none, i.e. all rights reserved).

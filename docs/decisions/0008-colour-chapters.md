# 0008 — The frame's look: "Colour chapters" (October 2026)

## Context

The home page, the bar around each game and the grown-ups page had grown one tile and one emoji at a time:
rounded white cards with thick outlines and drop shadows, a gradient header, a violet owl, small 13px text and
emoji as the only pictures. Ram asked for a redesign with the taste-skill art-direction tool. The 30 games keep
their insides (tested, voiced); only the frame changed.

## Decision

- **Idea:** the five levels are already named after a plant growing (Seeds, Sprouts, Buds, Blossoms, Fruits).
  Each level is one flat colour field, floor to ceiling, opening with its name set very large and a drawing of
  that stage; its games follow in two columns, each shown by **a picture of its real first round**
  (`img/games/<id>.webp`, made by `scripts/shots.mjs` + `scripts/shots-small.py`).
- **First screen:** the name, one sentence saying what this is, her progress, one magenta button for the game she
  should play next (or carry on), the real picture of that game, and the five levels as a column of colour blocks
  with how many games of each she has played.
- **One loud move:** a slim bar of the five level names sticks to the top while the chapters scroll and takes
  the colour of the chapter beneath it.
- **Type:** Chivo (SIL OFL, embedded in `src/styles/type.css`): 900 uppercase for display, 400/700 for text,
  body 17–19px. **Colour:** ink #0a0a0a, paper white, five level colours (`--c-lv1`…`--c-lv5`), magenta
  #f53fd6 only on the main action. No gradients, no shadows at rest, no emoji in the frame, one button shape
  (fully round).
- Tokens and fonts apply to the frame only (`.page-home`, `.page-play .bar/.banner/.dots`, `.page-grownups`);
  games still use `base.css` tokens and their system font, so nothing inside a game moved.

## Consequences

- When a game's first round changes, retake its picture: `PORT=8790 node scripts/serve.mjs &` then
  `node scripts/shots.mjs <id>` and `python3 scripts/shots-small.py` (needs Pillow).
- A new game needs its picture before it shows properly on the home page (the tile falls back to an empty frame).
- The open picture collections and the dealt typeface (General Sans) could not be reached from the build
  machine; the type was redrawn to Chivo and the pictures are the games' own screens.

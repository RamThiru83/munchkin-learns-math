# 0009 — Made for the child, not the grown-up

Status: accepted (2026-10-24). Refines 0008.

## Context

The 0008 frame looked good to adults but was built like a magazine: a black text-heavy first screen, capitals in a tight display face, 44px buttons with words only, and the grown-up settings as prominent as the games. The players are 4–7 and many cannot read yet.

## Decision

- **Pictures first.** The first screen is one big picture of the game to play next with a pulsing play button; levels are five large picture buttons (seed, sprout, bud, blossom, fruit); game tiles lead with the game's picture. Words always sit beside a picture, never alone.
- **Type for beginning readers.** Andika (SIL, made for early literacy: single-storey a and g, clear l/I/1), sentence case, body 18–20px. No capitals for display.
- **Big targets.** Every button at least 56px tall (play button 72–80px, finish-card next game about 120px). Frame buttons are icon + word (Home, Watch, Talk, Again, Voice).
- **Grown-up controls are quiet.** Voice, Sound and Grown-ups sit as small icon buttons in the top corner; the guide and settings are also in the footer.
- **Finish card shows the next game's picture** as its main button, with Play again and Home below; focus moves into the card.
- **Grown-up text is short.** One line per game (src/content/gists.js, checked by `npm run check`) plus one question to ask; the full note, age research and references sit under "More".
- **Accessible structure.** Each page has one h1 and a main landmark; the play page's game title is the h1; level-bar names stay readable by screen readers on phones where only the pictures show. axe-core (WCAG 2.1 AA + best practice): 0 violations on home, a game and the grown-ups page, desktop and phone.

## Consequences

Same routes, same saved data (`nilaa:` keys), same game contract; the 30 games are untouched. The frame tests changed only where visible words changed ("Round 4 of 5" resume tag).

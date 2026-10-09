# Content guide

Who it is for: children of about 4–7, usually with a parent beside them. The parent may read aloud instead of using the voice.

## Tone

- Calm, warm, short. Prompts are at most about 12 simple words: "Which jar has more?" not "Determine which container holds the greater quantity."
- Mistakes are normal. Use `api.nudge()` with a hint ("Count them one by one."), never "wrong", red crosses, buzzers, lives, timers or scores that go down.
- Vary praise ("Yes!", "Lovely counting!", "You found it!") but keep it specific when you can.
- No scary, violent or competitive-shaming themes. Animals and everyday objects work well.

## Look

- Original drawings only: emoji, inline SVG and CSS. No copied artwork, characters, logos or book illustrations.
- The owl guide is the site's own character; keep it consistent.
- Colours come from `src/lib/colors.js` / the CSS tokens in `src/styles/base.css`.

## Accessibility

- Touch targets ≥ 56 px where the layout allows; works from 360 px phones to desktop with no sideways scrolling.
- Every instruction is visible in the banner, so the game works with voice and sound off.
- Real `<button>` elements, with `aria-label` when the button shows only an emoji.
- Respect `prefers-reduced-motion` (handled globally in `base.css`; avoid motion that carries meaning on its own).

## Originality and sources

- The book inspires the activities; never copy its text, the children's dialogue or its pictures, and never use real children's names.
- Facts on the For grown-ups page need checked sources (see [AGE-GUIDE-SOURCES.md](AGE-GUIDE-SOURCES.md)).

## Privacy

- No accounts, analytics, ads, network requests or third-party scripts. Saved data stays in the browser.

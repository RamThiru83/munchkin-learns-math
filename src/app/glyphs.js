/**
 * Drawings for the frame: the five growing stages the levels are named after, a star, and the owl's
 * colours. Flat shapes in ink and paper only, so they sit on any level colour.
 */
import { h } from '../lib/core.js';

const INK = '#0a0a0a';
const PAPER = '#ffffff';

/** One drawing per level (1 Seeds … 5 Fruits), 200 × 200 units. */
const STAGES = {
  1: `<g fill="${INK}">
        <ellipse cx="62" cy="120" rx="22" ry="34" transform="rotate(-24 62 120)"/>
        <ellipse cx="112" cy="96" rx="22" ry="34" transform="rotate(14 112 96)"/>
        <ellipse cx="150" cy="146" rx="20" ry="31" transform="rotate(48 150 146)"/></g>
      <g fill="none" stroke="${PAPER}" stroke-width="5" stroke-linecap="round">
        <path d="M58 98 q-6 18 0 40"/><path d="M110 74 q8 16 4 40"/><path d="M140 130 q16 6 22 26"/></g>`,
  2: `<path d="M100 186 V96" stroke="${INK}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M100 112 C70 112 40 92 34 58 C68 56 96 76 100 112 Z" fill="${INK}"/>
      <path d="M100 98 C118 72 146 58 172 64 C164 94 132 106 100 98 Z" fill="${INK}"/>
      <path d="M48 66 C66 74 84 88 96 106" stroke="${PAPER}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M162 70 C140 76 122 86 106 96" stroke="${PAPER}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="186" rx="42" ry="8" fill="${INK}"/>`,
  3: `<path d="M100 192 V108" stroke="${INK}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M100 30 C130 62 136 96 100 120 C64 96 70 62 100 30 Z" fill="${INK}"/>
      <path d="M100 44 C112 66 114 90 100 110" stroke="${PAPER}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M100 124 C82 124 66 112 60 96 C80 96 94 104 100 124 Z M100 124 C118 124 134 112 140 96 C120 96 106 104 100 124 Z" fill="${INK}"/>
      <path d="M100 160 C78 162 58 150 50 132 C74 130 92 140 100 160 Z" fill="${INK}"/>`,
  4: `<g fill="${INK}">${[0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="100" cy="58" rx="30" ry="40" transform="rotate(${a} 100 100)"/>`)
    .join('')}</g>
      <circle cx="100" cy="100" r="24" fill="${PAPER}"/>
      <g fill="${INK}">${[0, 60, 120, 180, 240, 300]
        .map((a) => `<circle cx="100" cy="88" r="4" transform="rotate(${a} 100 100)"/>`)
        .join('')}</g>`,
  5: `<path d="M100 66 C70 44 26 60 30 112 C34 162 70 190 100 174 C130 190 166 162 170 112 C174 60 130 44 100 66 Z" fill="${INK}"/>
      <path d="M100 68 C100 50 104 36 112 24" stroke="${INK}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M110 40 C124 18 156 16 168 26 C156 44 128 50 110 40 Z" fill="${INK}"/>
      <path d="M58 94 C52 108 52 124 58 138" stroke="${PAPER}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
};

/** The drawing of a growing stage, as an <svg>. */
export function stageGlyph(level, cls = 'stage-glyph') {
  return h('svg', { viewBox: '0 0 200 200', class: cls, 'aria-hidden': 'true', html: STAGES[level] });
}

/** A five-pointed star; `filled` false draws only its outline. */
export function starIcon(filled = true, size = 22) {
  return h('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    class: `star-ic ${filled ? 'on' : 'off'}`,
    'aria-hidden': 'true',
    html: `<path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z" fill="${
      filled ? 'currentColor' : 'none'
    }" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  });
}

/** A row of `n` stars, `got` of them filled. */
export function starRow(got, n = 3, size = 22) {
  return h('span', { class: 'stars-row', role: 'img', 'aria-label': `${got} of ${n} stars` }, [
    ...Array.from({ length: n }, (_, k) => starIcon(k < got, size)),
  ]);
}

/** Simple line icons for buttons (always shown with a word beside or under them). 24 × 24, currentColor. */
const ICONS = {
  home: '<path d="M3.5 11.2 12 4l8.5 7.2M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  again:
    '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4.2h4.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  talk: '<path d="M4 5.5h16v10H10l-4.5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  voice:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  voiceOff:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sound:
    '<path d="M9 17.5V6.5l10-2v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/>',
  soundOff:
    '<path d="M9 17.5V6.5l10-2v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity=".45"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" opacity=".45"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  grownups:
    '<circle cx="9" cy="7.5" r="3" fill="currentColor"/><circle cx="16.5" cy="10.5" r="2.2" fill="currentColor"/><path d="M3.5 19.5c.4-3.6 2.6-5.5 5.5-5.5s5.1 1.9 5.5 5.5M13.8 19.5c.3-2.4 1.4-3.8 2.7-3.8 1.9 0 3.2 1.4 3.5 3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  next: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M12 19V6M6.5 11 12 5.5 17.5 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
};

/** An icon as an <svg>; decorative, so the button's words carry the meaning. */
export function icon(name, size = 26) {
  return h('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    class: 'ic',
    'aria-hidden': 'true',
    html: ICONS[name],
  });
}

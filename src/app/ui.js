/** Small UI pieces shared by the pages: the owl guide, on/off toggles and progress dots. */
import { h, sfx } from '../lib/core.js';

/** The owl guide (original character), drawn as inline SVG. */
export function owl(size = 84) {
  return h('svg', {
    viewBox: '0 0 100 100',
    width: size,
    height: size,
    class: 'owl',
    'aria-hidden': 'true',
    html: `
    <ellipse cx="50" cy="60" rx="30" ry="32" fill="#a78bfa"/>
    <ellipse cx="50" cy="68" rx="19" ry="21" fill="#ede9fe"/>
    <polygon points="26,34 30,14 42,28" fill="#8b5cf6"/><polygon points="74,34 70,14 58,28" fill="#8b5cf6"/>
    <circle cx="38" cy="45" r="13" fill="#fff"/><circle cx="62" cy="45" r="13" fill="#fff"/>
    <circle cx="38" cy="46" r="6" fill="#2b2d42"/><circle cx="62" cy="46" r="6" fill="#2b2d42"/>
    <circle cx="40" cy="44" r="2" fill="#fff"/><circle cx="64" cy="44" r="2" fill="#fff"/>
    <polygon points="45,53 55,53 50,62" fill="#ffb703"/>
    <ellipse cx="40" cy="92" rx="8" ry="4" fill="#ffb703"/><ellipse cx="60" cy="92" rx="8" ry="4" fill="#ffb703"/>`,
  });
}

/** An on/off button such as "🔊 Sound: on". `get` reads the current value, `set` changes it. */
export function toggle(emoji, label, get, set) {
  const text = () => `${emoji} ${label}: ${get() ? 'on' : 'off'}`;
  const b = h('button', { class: 'btn small toggle', 'aria-pressed': String(get()), title: label }, text());
  b.addEventListener('click', () => {
    set(!get());
    b.setAttribute('aria-pressed', String(get()));
    b.textContent = text();
    sfx('tap');
  });
  return b;
}

/** Progress dots for n rounds: rounds before `current` are filled, `current` is highlighted. */
export function roundDots(current, n) {
  return Array.from({ length: n }, (_, k) =>
    h('span', { class: `dot ${k < current ? 'full' : ''} ${k === current ? 'now' : ''}` }),
  );
}

/** Book citation as DOM nodes, with the title in italics. `long` adds publisher and ISBN. */
export function bookCitation(book, { long = false } = {}) {
  const tail = long
    ? `. ${book.series}. ${book.publisher}. ISBN ${book.isbn}.`
    : `. American Mathematical Society / MSRI, ${book.series}.`;
  return [`${book.author} (${book.year}). `, h('em', {}, book.title), tail];
}

/** Small UI pieces shared by the pages: the owl guide, on/off toggles and progress dots. */
import { h, sfx } from '../lib/core.js';
import { icon } from './glyphs.js';

/** The owl guide (original character), drawn as inline SVG. */
export function owl(size = 84) {
  return h('svg', {
    viewBox: '0 0 100 100',
    width: size,
    height: size,
    class: 'owl',
    'aria-hidden': 'true',
    html: `
    <ellipse cx="50" cy="60" rx="30" ry="32" fill="#0a0a0a"/>
    <ellipse cx="50" cy="68" rx="19" ry="21" fill="#ffd249"/>
    <polygon points="26,34 30,14 42,28" fill="#0a0a0a"/><polygon points="74,34 70,14 58,28" fill="#0a0a0a"/>
    <circle cx="38" cy="45" r="13" fill="#fff"/><circle cx="62" cy="45" r="13" fill="#fff"/>
    <circle cx="38" cy="46" r="6" fill="#0a0a0a"/><circle cx="62" cy="46" r="6" fill="#0a0a0a"/>
    <circle cx="40" cy="44" r="2" fill="#fff"/><circle cx="64" cy="44" r="2" fill="#fff"/>
    <polygon points="45,53 55,53 50,62" fill="#f9a21f"/>
    <ellipse cx="40" cy="92" rx="8" ry="4" fill="#f9a21f"/><ellipse cx="60" cy="92" rx="8" ry="4" fill="#f9a21f"/>`,
  });
}

/**
 * An on/off button such as "Voice on", with a picture for children who cannot read yet.
 * `get` reads the current value, `set` changes it. `icons` = [icon when on, icon when off].
 */
export function toggle(label, get, set, cls = 'pill', icons = null) {
  const words = h('span', { class: 'lbl' });
  const pic = h('span', { class: 'pic' });
  const b = h('button', { class: `${cls} toggle`, type: 'button', title: label }, icons ? pic : null, words);
  const draw = () => {
    words.textContent = `${label} ${get() ? 'on' : 'off'}`;
    b.setAttribute('aria-pressed', String(get()));
    if (icons) pic.replaceChildren(icon(get() ? icons[0] : icons[1]));
  };
  draw();
  b.addEventListener('click', () => {
    set(!get());
    draw();
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

/** Parts of each section rise into place once as they arrive (content is visible without script). */
export function revealOnScroll(root) {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const items = [...root.querySelectorAll('.reveal')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  items.forEach((el) => {
    const parent = el.closest('.games, .chapter-head, .about, .notes');
    const i = parent ? [...parent.querySelectorAll('.reveal')].indexOf(el) : 0;
    el.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`);
    // Only hide what is still below the fold, so nothing on screen blinks out.
    if (el.getBoundingClientRect().top > innerHeight) el.classList.add('pre');
    io.observe(el);
  });
  return () => io.disconnect();
}

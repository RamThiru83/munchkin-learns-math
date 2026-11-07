/**
 * Grown-up game lock (decision 0012), the same idea as the Little Scientists Club parent lock.
 * A grown-up sets a 4-digit PIN, then locks or unlocks games. Locked games show a padlock on the home page, are
 * skipped by "Play next" and "Next game", and opening one asks for the PIN (then it stays open for this visit).
 * Saved only in this browser (nilaa:lock, PIN stored as a salted SHA-256 hash); nothing is sent anywhere.
 * It is a child lock, not security: the site is static and clearing the browser's data removes the locks.
 *
 *   isBlocked(id)       locked and not opened with the PIN during this visit
 *   askFor(id, onOk)    the PIN keypad for one locked game
 *   openLockSettings()  PIN (set it the first time), then the list of games with lock switches
 */
import { h, store, sfx } from '../lib/core.js';
import { ACTIVITIES, LEVELS } from '../content/registry.js';

const KEY = 'lock';
const opened = new Set(); // games opened with the PIN during this visit
let st = load();
const listeners = new Set();

function load() {
  const v = store.get(KEY, null);
  if (v && typeof v === 'object')
    return { salt: v.salt || '', hash: v.hash || '', locked: Array.isArray(v.locked) ? v.locked : [] };
  return { salt: '', hash: '', locked: [] };
}
function save() {
  store.set(KEY, st);
  try {
    return JSON.stringify(store.get(KEY, null)) === JSON.stringify(st);
  } catch {
    return false;
  }
}
const changed = () => listeners.forEach((f) => f());
/** Call `fn` whenever the locks change (the home page repaints its tiles). Returns an unsubscribe function. */
export function onLockChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function digest(pin, salt) {
  const s = salt + ':' + pin;
  try {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall back below (pages opened from a file in some browsers) */
  }
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return 'f' + x.toString(16);
}

export const hasPin = () => !!st.hash;
export const isLocked = (id) => hasPin() && st.locked.includes(id);
export const isBlocked = (id) => isLocked(id) && !opened.has(id);
/** The first game from `list` a child may open now (for "Play next" and "Next game"). */
export const firstOpen = (list) => list.find((a) => !isBlocked(a.id)) || null;

// ---------- the dialog ----------
let back = null;
let lastFocus = null;
function dialog(...children) {
  lastFocus = document.activeElement;
  closeDialog(false);
  const x = h('button', { class: 'lk-x', type: 'button', 'aria-label': 'Close', onclick: () => closeDialog() }, '×');
  const box = h(
    'div',
    { class: 'lk-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lk-title' },
    x,
    ...children,
  );
  back = h('div', { class: 'lk-back', onclick: (e) => e.target === back && closeDialog() }, box);
  document.body.append(back);
  document.addEventListener('keydown', onEsc);
  return box;
}
function onEsc(e) {
  if (e.key === 'Escape') closeDialog();
}
export function closeDialog(restore = true) {
  if (!back) return;
  back.remove();
  back = null;
  document.removeEventListener('keydown', onEsc);
  if (restore && lastFocus?.focus) lastFocus.focus();
}

/** A 4-digit keypad; done(pin, showMessage) is called when four digits are in. */
function keypad(title, sub, done, extra = null) {
  let pin = '';
  const dots = [0, 1, 2, 3].map(() => h('span', {}));
  const msg = h('p', { class: 'lk-msg', 'aria-live': 'assertive' });
  const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const press = (k) => {
    sfx('tap');
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += k;
    msg.textContent = '';
    show();
    if (pin.length === 4) {
      const p = pin;
      setTimeout(() => {
        pin = '';
        show();
        done(p, (t) => (msg.textContent = t));
      }, 120);
    }
  };
  const keys = h(
    'div',
    { class: 'lk-keys' },
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('button', { type: 'button', onclick: () => press(String(n)) }, String(n))),
    h('span', {}),
    h('button', { type: 'button', onclick: () => press('0') }, '0'),
    h('button', { type: 'button', 'aria-label': 'Delete', onclick: () => press('del') }, '⌫'),
  );
  const box = dialog(
    h('h2', { id: 'lk-title' }, title),
    h('p', { class: 'lk-sub' }, sub),
    h('div', { class: 'lk-dots', 'aria-hidden': 'true' }, dots),
    msg,
    keys,
    extra,
  );
  box.addEventListener('keydown', (e) => {
    if (/^[0-9]$/.test(e.key)) {
      press(e.key);
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      press('del');
      e.preventDefault();
    }
  });
  keys.querySelector('button').focus();
  return msg;
}

function setPin(then) {
  keypad(
    'Set a grown-up PIN',
    'Choose 4 numbers. You will need them to lock and unlock games on this device.',
    (first) => {
      keypad('Type it again', 'The same 4 numbers, to be sure.', async (second, err) => {
        if (second !== first) {
          setPin(then).textContent = 'Those didn’t match. Let’s start again.';
          return;
        }
        st.salt = Math.random().toString(36).slice(2, 10);
        st.hash = await digest(first, st.salt);
        if (!save()) {
          st.hash = '';
          err('This browser is not letting the site save anything (private mode?). Locks can’t be kept here.');
          return;
        }
        changed();
        (then || admin)();
      });
    },
  );
  return document.querySelector('.lk-msg');
}

function askPin(why, onOk) {
  const forgotBtn = h('button', { type: 'button', class: 'lk-link', onclick: () => forgot() }, 'Forgot the PIN?');
  keypad(
    'Grown-ups only',
    why,
    async (pin, err) => {
      if ((await digest(pin, st.salt)) === st.hash) onOk();
      else err('Not quite. Try again, grown-up!');
    },
    h('p', { class: 'lk-forgot' }, forgotBtn),
  );
}

// Reset needs a grown-up question (a common parental gate), then a new PIN; the locks stay.
function forgot() {
  const a = 6 + Math.floor(Math.random() * 7);
  const b = 11 + Math.floor(Math.random() * 8);
  const inp = h('input', { class: 'lk-in', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Answer' });
  const msg = h('p', { class: 'lk-msg', 'aria-live': 'assertive' });
  const check = () => {
    if (Number(inp.value.trim()) === a * b) {
      st.hash = '';
      st.salt = '';
      save();
      setPin();
    } else {
      msg.textContent = 'Not quite. Ask a grown-up to help.';
      inp.value = '';
      inp.focus();
    }
  };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && check());
  dialog(
    h('h2', { id: 'lk-title' }, 'Reset the PIN'),
    h('p', { class: 'lk-sub' }, `Grown-ups: what is ${a} × ${b}?`),
    inp,
    msg,
    h('div', { class: 'lk-row' }, h('button', { type: 'button', class: 'pill primary', onclick: check }, 'Check')),
  );
  inp.focus();
}

function admin() {
  const count = h('p', { class: 'lk-count', 'aria-live': 'polite' });
  const boxes = [];
  const paintCount = () => {
    const n = ACTIVITIES.filter((a) => st.locked.includes(a.id)).length;
    count.textContent = n ? `${n} of ${ACTIVITIES.length} games locked` : 'No games locked';
  };
  const setLocked = (id, on) => {
    st.locked = st.locked.filter((x) => x !== id);
    if (on) {
      st.locked.push(id);
      opened.delete(id);
    }
  };
  const lists = LEVELS.map((lv) =>
    h(
      'section',
      { class: `lk-level lv${lv.n}` },
      h('h3', {}, `${lv.n} · ${lv.name}`),
      h(
        'ul',
        { class: 'lk-list' },
        ACTIVITIES.filter((a) => a.level === lv.n).map((a) => {
          const cb = h('input', { type: 'checkbox', 'data-game': a.id });
          cb.checked = st.locked.includes(a.id);
          cb.addEventListener('change', () => {
            setLocked(a.id, cb.checked);
            save();
            paintCount();
            changed();
          });
          boxes.push(cb);
          return h(
            'li',
            {},
            h(
              'label',
              {},
              cb,
              h('span', { class: 'lk-sw', 'aria-hidden': 'true' }),
              h('span', { class: 'lk-name' }, a.title),
            ),
          );
        }),
      ),
    ),
  );
  const all = (on) => {
    ACTIVITIES.forEach((a) => setLocked(a.id, on));
    boxes.forEach((b) => (b.checked = on));
    save();
    paintCount();
    changed();
  };
  dialog(
    h('h2', { id: 'lk-title' }, 'Grown-ups: lock games'),
    h(
      'p',
      { class: 'lk-sub' },
      'Locked games show a padlock and need your PIN to open. “Play next” skips them. Saved on this device only.',
    ),
    h(
      'div',
      { class: 'lk-row' },
      h('button', { type: 'button', class: 'pill', onclick: () => all(true) }, 'Lock all'),
      h('button', { type: 'button', class: 'pill', onclick: () => all(false) }, 'Unlock all'),
      count,
    ),
    h('div', { class: 'lk-levels' }, lists),
    h(
      'div',
      { class: 'lk-row' },
      h('button', { type: 'button', class: 'pill', onclick: () => setPin() }, 'Change PIN'),
      h(
        'button',
        {
          type: 'button',
          class: 'pill',
          onclick: () => {
            st = { salt: '', hash: '', locked: [] };
            opened.clear();
            store.set(KEY, null);
            changed();
            closeDialog();
          },
        },
        'Remove PIN and all locks',
      ),
      h('button', { type: 'button', class: 'pill primary', onclick: () => closeDialog() }, 'Done'),
    ),
  );
  paintCount();
}

/** The grown-ups' entry point: set a PIN the first time, otherwise ask for it, then show the game list. */
export function openLockSettings() {
  if (!hasPin()) setPin();
  else askPin('Type your PIN to choose which games are locked.', admin);
}

/** A locked game was asked for: the PIN opens it for this visit, then onOk() (e.g. go to the game). */
export function askFor(id, onOk) {
  const a = ACTIVITIES.find((x) => x.id === id);
  askPin(`“${a ? a.title : 'This game'}” is locked. Ask a grown-up to type the PIN.`, () => {
    opened.add(id);
    closeDialog(false);
    changed();
    onOk?.();
  });
}

/** For the tests. */
export const lockState = () => ({ hasPin: hasPin(), locked: st.locked.slice(), opened: [...opened] });

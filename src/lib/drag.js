/** Pointer-based drag and simple fly-to animations (mouse + touch). */
import { sleep } from './random.js';
import { unlockAudio } from './audio.js';

// drag(el, { dropSelector, onDrop(dropEl, el)=>bool|void, onStart, onEnd, bounds })
// - Works with mouse and touch (pointer events). The element follows the pointer via CSS transform.
// - On release, finds the element under the pointer matching `dropSelector`.
// - If onDrop returns false (or nothing matched) the element glides back to where it started.
// - `el.classList.add('dragging')` while held. Returns an object with `disable()` / `enable()`.
export function drag(el, opts = {}) {
  const { dropSelector = null, onDrop = null, onStart = null, onEnd = null, snapBack = true } = opts;
  let state = null;
  let enabled = true;
  el.style.touchAction = 'none';
  el.style.cursor = 'grab';
  el.style.userSelect = 'none';
  const down = (e) => {
    if (!enabled || (e.button != null && e.button > 0)) return;
    e.preventDefault();
    const base = el._dragBase || { x: 0, y: 0 };
    state = { sx: e.clientX, sy: e.clientY, bx: base.x, by: base.y, moved: false };
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('dragging');
    el.style.transition = 'none';
    el.style.zIndex = 1000;
    unlockAudio();
    onStart?.(el, e);
  };
  const move = (e) => {
    if (!state) return;
    const dx = e.clientX - state.sx;
    const dy = e.clientY - state.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
    el.style.transform = `translate(${state.bx + dx}px, ${state.by + dy}px) scale(1.08)`;
    el._dragPos = { x: state.bx + dx, y: state.by + dy };
  };
  const up = (e) => {
    if (!state) return;
    const st = state;
    state = null;
    el.classList.remove('dragging');
    el.releasePointerCapture?.(e.pointerId);
    let target = null;
    if (dropSelector) {
      const prev = el.style.pointerEvents;
      el.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      el.style.pointerEvents = prev;
      target = under ? under.closest(dropSelector) : null;
    }
    let ok = true;
    if (onDrop && (target || !dropSelector)) {
      const r = onDrop(target, el, st.moved);
      if (r === false) ok = false;
    } else if (dropSelector) ok = false;
    if (!ok && snapBack) glideBack(el);
    else {
      el.style.zIndex = '';
      if (el._dragBase === undefined) el._dragBase = null;
    }
    onEnd?.(el, ok);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return {
    disable() {
      enabled = false;
      el.style.cursor = 'default';
    },
    enable() {
      enabled = true;
      el.style.cursor = 'grab';
    },
  };
}
export function glideBack(el) {
  const base = el._dragBase || { x: 0, y: 0 };
  el.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)';
  el.style.transform = `translate(${base.x}px, ${base.y}px)`;
  el._dragPos = null;
  setTimeout(() => {
    el.style.zIndex = '';
    el.style.transition = '';
  }, 300);
}
// Move an element so its centre lands on the centre of `target` (both are in the page). Animated.
export function flyTo(el, target, { duration = 400, offset = { x: 0, y: 0 } } = {}) {
  const a = el.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const base = el._dragPos || el._dragBase || { x: 0, y: 0 };
  const nx = base.x + (b.left + b.width / 2 - (a.left + a.width / 2)) + offset.x;
  const ny = base.y + (b.top + b.height / 2 - (a.top + a.height / 2)) + offset.y;
  el.style.transition = `transform ${duration}ms cubic-bezier(.4,.1,.2,1)`;
  el.style.transform = `translate(${nx}px, ${ny}px)`;
  el._dragBase = { x: nx, y: ny };
  el._dragPos = null;
  return sleep(duration);
}

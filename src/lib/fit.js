/**
 * Fit a game to the screen (decision 0011): the game draws into `fit`; when its natural size is bigger than the
 * stage, `fit` is scaled down with a CSS transform so the whole game is visible without scrolling. It is never
 * scaled up. The scale is kept on fit.dataset.fitScale so pointer code can convert screen pixels into the game's
 * own (unscaled) pixels: see scaleOf() and fixedAt().
 */
const MIN = 0.5; // below this the game would be too small to tap; the stage scrolls instead

/** Watch `fit` and `stage` and keep `fit` scaled to fit. Returns a function that stops watching. */
export function fitToStage(stage, fit) {
  let raf = 0;
  const forced = (() => {
    try {
      return Number(localStorage.getItem('nilaa:fitscale')) || 0; // tests: force a scale to check pointer maths
    } catch {
      return 0;
    }
  })();
  const apply = () => {
    raf = 0;
    if (!fit.isConnected) return;
    const cs = getComputedStyle(stage);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const natH = Math.max(fit.offsetHeight, fit.scrollHeight); // layout size: not changed by the transform
    const natW = Math.max(fit.scrollWidth, fit.offsetWidth);
    let k = Math.min(1, availH / natH || 1, availW / natW || 1);
    if (forced) k = forced;
    k = Math.max(MIN, Math.floor(k * 1000) / 1000);
    if (k >= 0.999) {
      fit.style.transform = '';
      fit.style.marginBottom = '';
      delete fit.dataset.fitScale;
    } else {
      fit.style.transform = `scale(${k})`;
      fit.style.marginBottom = `${-natH * (1 - k)}px`; // the layout box shrinks with the picture: no scroll bar
      fit.dataset.fitScale = String(k);
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(stage);
  ro.observe(fit);
  // content that grows sideways does not resize `fit` itself, so also watch what the game adds and changes
  const mo = new MutationObserver(schedule);
  mo.observe(fit, { childList: true, subtree: true });
  return () => {
    ro.disconnect();
    mo.disconnect();
    cancelAnimationFrame(raf);
  };
}

/** How much the game an element belongs to is scaled on screen (1 = not scaled). */
export function scaleOf(el) {
  const f = el && el.closest ? el.closest('[data-fit-scale]') : null;
  return f ? Number(f.dataset.fitScale) || 1 : 1;
}

/**
 * Where to put a position:fixed element that lives inside the game so it appears at screen point (x, y).
 * (A transformed ancestor becomes the containing block of fixed elements, and scales them.)
 */
export function fixedAt(el, x, y) {
  const f = el && el.closest ? el.closest('[data-fit-scale]') : null;
  if (!f) return { x, y };
  const k = Number(f.dataset.fitScale) || 1;
  const r = f.getBoundingClientRect();
  return { x: (x - r.left) / k, y: (y - r.top) / k };
}

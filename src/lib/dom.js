/**
 * Tiny DOM builder used everywhere instead of a framework.
 *   h('button', { class: 'btn', onclick: fn }, 'Label', childEl)
 * - SVG tag names are created in the SVG namespace automatically.
 * - `on<event>` attributes with a function value become event listeners.
 * - `html` sets innerHTML (only ever used with our own static SVG strings).
 * - false / null / undefined attributes and children are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const isSvg = [
    'svg',
    'g',
    'path',
    'circle',
    'rect',
    'line',
    'polygon',
    'polyline',
    'ellipse',
    'text',
    'defs',
    'use',
    'clipPath',
    'linearGradient',
    'stop',
    'animate',
    'animateTransform',
  ].includes(tag);
  const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

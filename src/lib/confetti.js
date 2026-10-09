/** Celebration confetti (pure CSS animation, removed after ~3 s). */
import { h } from './dom.js';
import { rand } from './random.js';

export function confetti(root = document.body, n = 36) {
  const colors = ['#ff8fab', '#ffd166', '#06d6a0', '#4cc9f0', '#b794f4', '#ff9f68'];
  const layer = h('div', { class: 'confetti-layer', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const p = h('i', {
      style: {
        left: Math.random() * 100 + '%',
        background: colors[i % colors.length],
        animationDelay: Math.random() * 0.35 + 's',
        animationDuration: 1.4 + Math.random() * 1.2 + 's',
        transform: `rotate(${rand(360)}deg)`,
      },
    });
    layer.append(p);
  }
  root.append(layer);
  setTimeout(() => layer.remove(), 3200);
}

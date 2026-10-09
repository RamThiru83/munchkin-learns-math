/**
 * Entry point. A tiny hash router:
 *   #/            home map          (pages/home.js)
 *   #/play/<id>   one game          (pages/play.js)
 *   #/grownups    For grown-ups     (pages/grownups.js)
 * Hash routing keeps the site a set of static files (works on GitHub Pages and from a single HTML file).
 */
import { stopSpeaking } from '../lib/core.js';
import { renderHome } from './pages/home.js';
import { renderPlay } from './pages/play.js';
import { renderGrownups } from './pages/grownups.js';

const app = document.getElementById('app');
let current = null; // handle with destroy() for the page on screen

function teardown() {
  try {
    current?.destroy?.();
  } catch (e) {
    console.error(e);
  }
  current = null;
  stopSpeaking();
  app.className = '';
  app.replaceChildren();
}

function route() {
  const hash = location.hash || '#/';
  teardown();
  if (hash.startsWith('#/play/')) current = renderPlay(app, decodeURIComponent(hash.slice('#/play/'.length)));
  else if (hash === '#/grownups') renderGrownups(app);
  else renderHome(app);
}

window.addEventListener('hashchange', route);
route();

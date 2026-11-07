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
import { isBlocked, askFor, onLockChange } from './lock.js';

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
  if (hash.startsWith('#/play/')) {
    const id = decodeURIComponent(hash.slice('#/play/'.length));
    if (isBlocked(id)) {
      // a locked game (a tile, a link or a typed address): show the home page and ask for the grown-up PIN
      history.replaceState(null, '', '#/');
      current = renderHome(app);
      askFor(id, () => (location.hash = '#/play/' + encodeURIComponent(id)));
      return;
    }
    current = renderPlay(app, id);
  } else if (hash === '#/grownups') renderGrownups(app);
  else current = renderHome(app);
}

// Locks changed (grown-ups dialog): redraw the home page so padlocks and "Play next" are up to date.
onLockChange(() => {
  const h = location.hash || '#/';
  if (!h.startsWith('#/play/') && h !== '#/grownups') {
    const y = scrollY;
    route();
    scrollTo(0, y);
  }
});

window.addEventListener('hashchange', route);
route();

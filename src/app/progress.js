/**
 * Saved progress for each game, kept in this browser's localStorage.
 *
 * Stored keys (all prefixed `nilaa:` by lib/storage.js):
 *   schema   – number, version of the shape below (see SCHEMA / migrate()).
 *   progress – { [gameId]: stars }        stars earned when a game was finished (currently always 3).
 *   resume   – { [gameId]: { r, n } }     round the child is on (zero-based r, of n rounds); absent = start fresh.
 *   sound, voice – grown-up settings (lib/settings.js).
 *
 * Rules for future changes (see docs/decisions/0004-saved-progress.md):
 *   - Never rename or delete a key without a migration. Children's stars must survive every update.
 *   - If you change a shape, bump SCHEMA and add a step to MIGRATIONS.
 *   - If you rename a game id, add it to RENAMED_IDS so its saved progress follows it.
 */
import { store } from '../lib/core.js';

export const SCHEMA = 2;

/** Old game id -> new game id. Applied on load. */
const RENAMED_IDS = {};

/** MIGRATIONS[v] upgrades data from schema v to v + 1. */
const MIGRATIONS = {
  // v1 (Oct 2026): progress + resume, no schema key. v2 only adds the schema key.
  1: (data) => data,
};

function load() {
  let data = { progress: store.get('progress', {}), resume: store.get('resume', {}) };
  let v = store.get('schema', 1);
  while (v < SCHEMA) {
    data = (MIGRATIONS[v] || ((d) => d))(data);
    v += 1;
  }
  for (const [from, to] of Object.entries(RENAMED_IDS)) {
    for (const table of [data.progress, data.resume]) {
      if (from in table && !(to in table)) table[to] = table[from];
      delete table[from];
    }
  }
  store.set('schema', SCHEMA);
  store.set('progress', data.progress);
  store.set('resume', data.resume);
  return data;
}

const data = load();
const save = () => {
  store.set('progress', data.progress);
  store.set('resume', data.resume);
};

/** Stars earned for a game (0 if never finished). */
export const starsFor = (id) => data.progress[id] || 0;

/** Record a finished game; keeps the best score. */
export function awardStars(id, stars) {
  data.progress[id] = Math.max(starsFor(id), stars);
  save();
}

export const totalStars = () => Object.values(data.progress).reduce((s, n) => s + n, 0);

export const finishedCount = (ids) => ids.filter((id) => starsFor(id) > 0).length;

/** Saved round for a game, or null. `{ r, n }`: zero-based round r of n rounds. */
export function savedRound(id) {
  const s = data.resume[id];
  return s && s.r > 0 && s.r < s.n ? s : null;
}

/** Remember that the child is now on round r (zero-based) of n. Round 0 clears the saved round. */
export function saveRound(id, r, n) {
  if (r > 0 && r < n) data.resume[id] = { r, n };
  else delete data.resume[id];
  save();
}

export function clearRound(id) {
  delete data.resume[id];
  save();
}

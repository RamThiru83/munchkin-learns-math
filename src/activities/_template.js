/**
 * Game: <Title>  (id: <id>, level <n>)
 *
 * Idea: <the maths idea in one sentence, and where it comes from>.
 * Rounds:
 *   1. <very easy>
 *   2. ...
 *   5. <the real challenge for a capable 6–7-year-old>
 * Watch demo: animates a correct solution of the current round.
 *
 * Copy this file with `npm run new-game -- <id>`; see docs/GAME-CONTRACT.md.
 */
import { h, sleep, resumeRound } from '../lib/core.js';

const ID = '<id>';
const ROUNDS = [
  { prompt: 'Tap the star!', target: '⭐' },
  { prompt: 'Tap the moon!', target: '🌙' },
  { prompt: 'Tap the sun!', target: '☀️' },
  { prompt: 'Tap the cloud!', target: '☁️' },
  { prompt: 'Tap the rainbow!', target: '🌈' },
];
const CHOICES = ['⭐', '🌙', '☀️', '☁️', '🌈'];

const CSS = `
.a-${ID} { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; }
`;

export default {
  id: ID,
  rounds: ROUNDS.length,
  parentNote: 'Two or three sentences for the grown-up: the idea, what to ask, the common misconception.',

  async start(api) {
    let alive = true; // false after destroy(); check it after every await
    let round = resumeRound(api, ROUNDS.length);
    api.css(CSS);
    const wrap = h('div', { class: `a-${ID}` });
    api.root.append(wrap);

    function showRound() {
      const r = ROUNDS[round];
      api.stage(round, ROUNDS.length);
      api.prompt(r.prompt);
      wrap.replaceChildren(
        h(
          'div',
          { class: 'act-row' },
          CHOICES.map((c) =>
            h('button', { class: 'chip choice', 'aria-label': c, 'data-choice': c, onclick: () => choose(c) }, c),
          ),
        ),
      );
    }

    async function choose(c) {
      if (c !== ROUNDS[round].target) {
        api.nudge('Not that one. Look again!');
        return;
      }
      await api.cheer('Yes!');
      if (!alive) return;
      round += 1;
      if (round < ROUNDS.length) showRound();
      else api.finish();
    }

    api.setDemo(async () => {
      const btn = wrap.querySelector(`[data-choice="${ROUNDS[round].target}"]`);
      btn?.classList.add('glow');
      await api.say(`I look for the ${ROUNDS[round].target}.`);
      await sleep(600);
      if (!alive) return;
      btn?.classList.remove('glow');
    });

    showRound();
    return {
      destroy() {
        alive = false;
      },
    };
  },
};

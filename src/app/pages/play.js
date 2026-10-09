/**
 * Play page: the frame around one game. Route: #/play/<id>
 *
 * Builds the top bar (Map, title, Watch, Again, Voice), the owl banner, the stage the
 * game draws into, and the progress dots. Loads the game module and gives it the `api`
 * object described in docs/GAME-CONTRACT.md.
 */
import * as core from '../../lib/core.js';
import { ACTIVITIES } from '../../content/registry.js';
import { loaders } from '../../activities/index.js';
import { awardStars, savedRound, saveRound, clearRound } from '../progress.js';
import { owl, toggle, roundDots } from '../ui.js';

const { h, say, sfx, confetti, settings, setVoiceOn, stopSpeaking } = core;

const STARS_FOR_FINISHING = 3;

/**
 * Show a game. Returns a `{ destroy() }` handle the router calls when leaving the page.
 * @param {HTMLElement} app
 * @param {string} id
 */
export function renderPlay(app, id) {
  const meta = ACTIVITIES.find((a) => a.id === id);
  if (!meta) {
    location.hash = '#/';
    return { destroy() {} };
  }
  app.className = `page-play lv${meta.level}`;

  // ---- frame ----
  const bannerText = h('span', {});
  const banner = h(
    'div',
    { class: 'banner', 'aria-live': 'polite' },
    h('div', { class: 'banner-owl' }, owl(48)),
    bannerText,
    h(
      'button',
      {
        class: 'icon-btn',
        title: 'Hear it again',
        'aria-label': 'Hear it again',
        onclick: () => say(bannerText.textContent),
      },
      '🔈',
    ),
  );
  const dots = h('div', { class: 'dots' });
  const stage = h('div', { class: 'stage' });
  const watchBtn = h('button', { class: 'btn small watch', hidden: true }, '👀 Watch');
  const againBtn = h('button', { class: 'btn small', title: 'Start this round again' }, '↻ Again');
  const bar = h(
    'div',
    { class: 'bar' },
    h('a', { class: 'btn small', href: '#/' }, '← Map'),
    h('div', { class: 'bar-title' }, `${meta.emoji} ${meta.title}`),
    watchBtn,
    againBtn,
    toggle('🗣️', 'Voice', () => settings.voice, setVoiceOn),
  );
  app.append(bar, banner, stage, dots);

  // ---- state for the mounted game ----
  let game = null; // value returned by the game's start(): { destroy() }
  let styleEls = []; // <style> elements the game added via api.css()
  let demoFn = null; // the game's Watch demo
  let demoRunning = false;
  let generation = 0; // bumps on every (re)mount so a stale demo can't touch the new game
  let currentRound = 0;

  watchBtn.addEventListener('click', async () => {
    if (!demoFn || demoRunning) return;
    demoRunning = true;
    watchBtn.disabled = true;
    stage.classList.add('demo-running');
    const g = generation;
    try {
      await demoFn();
    } catch (e) {
      console.error('demo error', e);
    }
    if (g === generation) {
      demoRunning = false;
      watchBtn.disabled = false;
      stage.classList.remove('demo-running');
    }
  });
  againBtn.addEventListener('click', () => {
    sfx('tap');
    mount(currentRound);
  });

  function unmountGame() {
    try {
      game?.destroy?.();
    } catch (e) {
      console.error(e);
    }
    game = null;
    styleEls.forEach((s) => s.remove());
    styleEls = [];
  }

  function setBanner(text, mood) {
    bannerText.textContent = text;
    banner.classList.remove('good', 'try');
    if (mood) banner.classList.add(mood);
  }

  /** (Re)start the game on round `startAt` (zero-based). */
  async function mount(startAt = 0) {
    currentRound = startAt;
    generation += 1;
    demoRunning = false;
    watchBtn.disabled = false;
    stage.classList.remove('demo-running');
    unmountGame();
    stopSpeaking();
    stage.replaceChildren();
    dots.replaceChildren();
    demoFn = null;
    watchBtn.hidden = true;
    bannerText.textContent = '';

    let mod;
    try {
      mod = (await loaders[id]()).default;
    } catch (e) {
      console.error(e);
      stage.append(h('p', { class: 'err' }, 'This game is still being made. Please come back soon!'));
      return;
    }

    /** The api object every game receives. See docs/GAME-CONTRACT.md. */
    const api = {
      ...core,
      root: stage,
      meta,
      resume: startAt,
      prompt(text) {
        setBanner(text);
        banner.classList.add('pulse');
        setTimeout(() => banner.classList.remove('pulse'), 600);
        return say(text);
      },
      cheer(text = 'Well done!') {
        setBanner(text, 'good');
        sfx('good');
        return say(text);
      },
      nudge(text = 'Hmm, let us try again.') {
        setBanner(text, 'try');
        sfx('oops');
        return say(text);
      },
      stage(i, n) {
        if (i >= 0 && i < n) {
          currentRound = i;
          saveRound(id, i, n);
        }
        dots.replaceChildren(...roundDots(i, n));
      },
      setDemo(fn) {
        demoFn = fn;
        watchBtn.hidden = !fn;
      },
      css(text) {
        const s = h('style', {}, text);
        document.head.append(s);
        styleEls.push(s);
      },
      finish() {
        clearRound(id);
        currentRound = 0;
        awardStars(id, STARS_FOR_FINISHING);
        celebrate();
      },
    };

    try {
      game = (await mod.start(api)) || {};
    } catch (e) {
      console.error(e);
      stage.replaceChildren(h('p', { class: 'err' }, 'Oops, something went wrong in this game.'));
    }
  }

  function celebrate() {
    sfx('win');
    confetti(document.body, 60);
    const nextAct = ACTIVITIES[ACTIVITIES.indexOf(meta) + 1];
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'card' },
        owl(80),
        h('h2', {}, 'Hooray! You did it!'),
        h('div', { class: 'bigstars' }, '⭐'.repeat(STARS_FOR_FINISHING)),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                overlay.remove();
                mount(0);
              },
            },
            '↻ Play again',
          ),
          nextAct
            ? h('a', { class: 'btn primary', href: `#/play/${nextAct.id}` }, `Next: ${nextAct.title} →`)
            : h('a', { class: 'btn primary', href: '#/' }, 'Back to the map'),
          h('a', { class: 'btn', href: '#/' }, 'Map'),
        ),
      ),
    );
    app.append(overlay);
    say('Hooray! You did it!');
  }

  /** Welcome-back card: carry on from the saved round, or start again from round 1. */
  function offerResume(saved) {
    bannerText.textContent = 'Welcome back!';
    dots.replaceChildren(...roundDots(saved.r, saved.n));
    stage.append(
      h(
        'div',
        { class: 'resume-card' },
        owl(72),
        h('h2', {}, 'Welcome back!'),
        h('p', {}, `You finished ${saved.r} of ${saved.n} rounds last time.`),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn primary',
              'data-resume': 'continue',
              onclick: () => {
                sfx('pop');
                mount(saved.r);
              },
            },
            `▶ Carry on from round ${saved.r + 1}`,
          ),
          h(
            'button',
            {
              class: 'btn',
              'data-resume': 'restart',
              onclick: () => {
                sfx('tap');
                clearRound(id);
                mount(0);
              },
            },
            '↻ Start from round 1',
          ),
        ),
      ),
    );
    say(`Welcome back! Shall we carry on from round ${saved.r + 1}?`);
  }

  const saved = savedRound(id);
  if (saved) offerResume(saved);
  else mount(0);

  return { destroy: unmountGame };
}

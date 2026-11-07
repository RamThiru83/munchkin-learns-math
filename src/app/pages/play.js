/**
 * Play page: the frame around one game. Route: #/play/<id>
 *
 * Builds the top bar (Home, title, Watch, Talk, Again, Voice; each a picture with a word), the owl banner, the stage the
 * game draws into, and the progress dots. Loads the game module and gives it the `api`
 * object described in docs/GAME-CONTRACT.md.
 */
import * as core from '../../lib/core.js';
import { ACTIVITIES } from '../../content/registry.js';
import { loaders } from '../../activities/index.js';
import { awardStars, savedRound, saveRound, clearRound } from '../progress.js';
import { owl, toggle, roundDots } from '../ui.js';
import { starRow, icon } from '../glyphs.js';
import { gamePicture } from './home.js';
import { loadVoicePack, voiceReady, fastTests } from '../../lib/speech.js';
import { RHYMES, SONGS, MOVES } from '../../content/rhymes.js';
import { songCard } from '../sing.js';
import { fitToStage } from '../../lib/fit.js';
import { firstOpen } from '../lock.js';

const { h, say, sfx, confetti, settings, setVoiceOn, stopSpeaking, jingle, band } = core;

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
  loadVoicePack('app');
  const packReady = loadVoicePack(id);
  app.className = `page-play lv${meta.level}`;

  // ---- frame ----
  const bannerText = h('span', {});
  const banner = h(
    'div',
    { class: 'banner', 'aria-live': 'polite' },
    h('div', { class: 'banner-owl' }, owl(48)),
    bannerText,
    h('button', {
      class: 'icon-btn',
      title: 'Hear it again',
      'aria-label': 'Hear it again',
      onclick: () => say(bannerText.textContent),
      html: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    }),
  );
  const dots = h('div', { class: 'dots' });
  const stage = h('main', { class: 'stage', id: 'main' });
  // The game draws into `fit`, which is scaled down (never up) so the whole game always fits the screen without
  // scrolling (decision 0011). drag.js and fixedAt() in lib/fit.js turn screen pixels into the game's own pixels.
  const fit = h('div', { class: 'fit' });
  const stopFit = fitToStage(stage, fit);
  /** A frame button: picture above (or beside) a short word, at least 56px tall. */
  const tool = (cls, pic, word, attrs = {}) =>
    h('button', { class: `pill ${cls}`, type: 'button', ...attrs }, icon(pic), h('span', { class: 'lbl' }, word));
  const watchBtn = tool('watch', 'eye', 'Watch', { hidden: true, title: 'Watch how to play' });
  const againBtn = tool('again', 'again', 'Again', { title: 'Start this round again' });
  // "Talk together": short questions for the grown-up (from the game's talkPrompts or api.setTalk).
  const talkBtn = tool('talk-btn', 'talk', 'Talk', {
    hidden: true,
    'aria-expanded': 'false',
    title: 'Questions to ask together',
  });
  const talkList = h('ul', {});
  const talkPanel = h(
    'aside',
    { class: 'talk', hidden: true, 'aria-label': 'Questions to ask together' },
    h('strong', {}, 'Ask together: '),
    talkList,
  );
  const bar = h(
    'header',
    { class: 'bar' },
    h('a', { class: 'pill back', href: '#/' }, icon('home'), h('span', { class: 'lbl' }, 'Home')),
    h('h1', { class: 'bar-title' }, meta.title),
    h(
      'div',
      { class: 'bar-tools' },
      watchBtn,
      talkBtn,
      againBtn,
      toggle('Voice', () => settings.voice, setVoiceOn, 'pill', ['voice', 'voiceOff']),
    ),
  );
  app.append(bar, banner, talkPanel, stage, dots);

  // ---- state for the mounted game ----
  let game = null; // value returned by the game's start(): { destroy() }
  let styleEls = []; // <style> elements the game added via api.css()
  let demoFn = null; // the game's Watch demo
  let demoRunning = false;
  let generation = 0; // bumps on every (re)mount so a stale demo can't touch the new game
  let currentRound = 0;
  let lastStage = 0; // round the progress dots last showed (a jingle plays when it moves on)
  let rhyme = null; // { card, wrap } while the opening rhyme is on screen
  let song = null; // the finish song's card while it plays
  let bed = null; // the soft beat under a sung instruction
  const endBed = (fade = 0.7) => {
    bed?.stop(fade);
    bed = null;
  };

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
  talkBtn.addEventListener('click', () => {
    sfx('tap');
    talkPanel.hidden = !talkPanel.hidden;
    talkBtn.setAttribute('aria-expanded', String(!talkPanel.hidden));
  });
  function setTalk(prompts) {
    const list = Array.isArray(prompts) ? prompts.filter(Boolean) : [];
    talkList.replaceChildren(...list.map((q) => h('li', {}, q)));
    talkBtn.hidden = list.length === 0;
    if (!list.length) talkPanel.hidden = true;
  }
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

  function stopMusic() {
    endBed(0.2);
    if (rhyme) {
      rhyme.card.stop();
      rhyme.wrap.remove();
      rhyme = null;
    }
    song?.stop();
    song = null;
  }

  /** Rhyme time: chant the game's rhyme over its level's tune, then start round 1 (tap to start sooner). */
  function startWithRhyme() {
    const lines = RHYMES[id];
    if (!lines || fastTests()) return mount(0);
    loaders[id]().catch(() => {}); // fetch the game while the rhyme plays
    const card = songCard({ lines, level: meta.level });
    const go = h(
      'button',
      { class: 'pill primary go-play', type: 'button' },
      icon('play', 30),
      h('span', {}, 'Let’s play!'),
    );
    const wrap = h('div', { class: 'rhyme-wrap' }, card.el, go);
    rhyme = { card, wrap };
    stage.append(wrap);
    bannerText.textContent = 'Rhyme time! Say it with me.';
    const begin = () => {
      if (rhyme?.card !== card) return;
      stopMusic();
      mount(0);
    };
    go.addEventListener('click', () => {
      sfx('pop');
      begin();
    });
    card.play().then((r) => {
      if (r === 'done') {
        go.classList.add('ready');
        setTimeout(begin, 1200);
      }
    });
  }

  /** (Re)start the game on round `startAt` (zero-based). */
  async function mount(startAt = 0) {
    stopMusic();
    currentRound = startAt;
    lastStage = startAt;
    generation += 1;
    demoRunning = false;
    watchBtn.disabled = false;
    stage.classList.remove('demo-running');
    unmountGame();
    stopSpeaking();
    stage.replaceChildren(fit);
    fit.replaceChildren();
    dots.replaceChildren();
    demoFn = null;
    watchBtn.hidden = true;
    bannerText.textContent = '';

    let mod;
    try {
      // Load the game and its recorded voice together, so the first line is spoken by the recorded
      // voice (the pack wait is capped: on a slow connection the game starts anyway and early lines
      // use the browser voice until the pack arrives).
      const gen = generation;
      const slow = setTimeout(() => {
        if (gen === generation && !bannerText.textContent) bannerText.textContent = 'Getting ready…';
      }, 600);
      const [loaded] = await Promise.all([loaders[id](), voiceReady(packReady, 6000)]);
      clearTimeout(slow);
      if (gen !== generation) return;
      if (bannerText.textContent === 'Getting ready…') bannerText.textContent = '';
      mod = loaded.default;
    } catch (e) {
      console.error(e);
      stage.append(h('p', { class: 'err' }, 'This game is still being made. Please come back soon!'));
      return;
    }
    setTalk(mod.talkPrompts);
    // While the child plays, fetch the next game's voice so it starts without a wait.
    const after = ACTIVITIES[ACTIVITIES.indexOf(meta) + 1];
    if (after) setTimeout(() => loadVoicePack(after.id), 4000);

    /** The api object every game receives. See docs/GAME-CONTRACT.md. */
    const api = {
      ...core,
      root: fit,
      meta,
      resume: startAt,
      prompt(text) {
        setBanner(text);
        banner.classList.add('pulse');
        setTimeout(() => banner.classList.remove('pulse'), 600);
        // Instructions are chanted over a soft beat in the level's style (with the music switched on).
        if (!settings.music || !settings.voice || demoRunning || fastTests()) return say(text);
        endBed(0.2);
        const mine = band(meta.level, { lite: true });
        bed = mine;
        if (mine) {
          mine.duck(true);
          banner.style.setProperty('--beat', `${mine.beat}s`);
          banner.classList.add('singing');
        }
        return say(text).finally(() => {
          if (bed === mine) {
            endBed();
            banner.classList.remove('singing');
          }
        });
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
        if (i > lastStage && !demoRunning) jingle(meta.level); // ta-da: a round is done
        lastStage = i;
        dots.replaceChildren(...roundDots(i, n));
      },
      setTalk,
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
    // Song time: the level's finish song, with a move to do (clap, wiggle, jump, spin, dance)
    const finale =
      SONGS[meta.level] && !fastTests()
        ? songCard({ lines: SONGS[meta.level], level: meta.level, title: 'Song time!', move: MOVES[meta.level] })
        : null;
    const nextAct = firstOpen(ACTIVITIES.slice(ACTIVITIES.indexOf(meta) + 1)); // skips games a grown-up locked
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'done-h' },
        finale ? null : owl(80),
        h('h2', { id: 'done-h' }, 'Hooray! You did it!'),
        h('div', { class: 'bigstars' }, starRow(STARS_FOR_FINISHING, STARS_FOR_FINISHING, 44)),
        finale ? finale.el : null,
        nextAct
          ? h(
              'a',
              { class: 'next-game', href: `#/play/${nextAct.id}` },
              h('img', { src: gamePicture(nextAct.id), alt: '', width: 480, height: 360 }),
              h(
                'span',
                { class: 'next-words' },
                h('span', { class: 'next-kicker' }, icon('play', 22), 'Next game'),
                h('strong', {}, nextAct.title),
              ),
            )
          : h('a', { class: 'pill primary', href: '#/' }, icon('home'), 'All 30 games done! Home'),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'pill',
              type: 'button',
              onclick: () => {
                overlay.remove();
                mount(0);
              },
            },
            icon('again'),
            'Play again',
          ),
          h('a', { class: 'pill', href: '#/' }, icon('home'), 'Home'),
        ),
      ),
    );
    app.append(overlay);
    overlay.querySelector('a, button')?.focus({ preventScroll: true });
    song = finale;
    say('Hooray! You did it!').then(() => {
      if (song === finale) finale?.play();
    });
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
              class: 'pill primary',
              'data-resume': 'continue',
              onclick: () => {
                sfx('pop');
                mount(saved.r);
              },
            },
            icon('play'),
            `Carry on from round ${saved.r + 1}`,
          ),
          h(
            'button',
            {
              class: 'pill',
              'data-resume': 'restart',
              onclick: () => {
                sfx('tap');
                clearRound(id);
                mount(0);
              },
            },
            icon('again'),
            'Start from round 1',
          ),
        ),
      ),
    );
    say(`Welcome back! Shall we carry on from round ${saved.r + 1}?`);
  }

  loadVoicePack('songs');
  const saved = savedRound(id);
  if (saved) offerResume(saved);
  else startWithRhyme();

  return {
    destroy() {
      stopMusic();
      unmountGame();
      stopFit();
    },
  };
}

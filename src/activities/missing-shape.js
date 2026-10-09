/**
 * Game: The Missing Shape  (id: missing-shape, level 2)
 *
 * Idea: a small grid of coloured shapes follows a Latin-square rule (each row and column repeats nothing);
 *   one square is empty and the child picks the piece that fits.
 * Rounds:
 *   1. 2x2: colour is the same along each row, shape along each column (or the other way round).
 *   2. 3x3: only one thing changes (shape or colour); every row and column holds all three.
 *   3. 3x3: colour AND shape both change; each row and column has each colour once and each shape once.
 *   4. 4x4: only one thing changes; every row and column holds all four colours (or all four shapes).
 *   5. 4x4: colour AND shape both change; all 16 colour-shape pairs appear once (two orthogonal Latin squares).
 * Watch demo: re-sets the round, walks (hops + highlights) each row, then the hole's column, names the missing
 *   piece, glows it and flies it in; then deals a fresh puzzle of the same round for the child.
 * Notes:
 *   - Puzzles are generated at random; build() is re-run (up to 100 times) until verify() confirms that the answer
 *     is the ONLY one of the 20 colour x shape pieces that satisfies the round's rule and that every other
 *     choice breaks it. Red and green are never mixed in one palette (colour-blind friendly).
 *   - build() branches on the round index (0..4); round 2 is the final `else` branch.
 *   - Test hook: the default export's `_make(round)` is makePuzzle (returns {grid, hole, answer, choices, rule}).
 *   - Tap flies the piece into the hole; drag carries it (drop within DROP_TOLERANCE x cell width of the hole).
 */
import { h, sleep, shuffle, rand, pick, flyTo, glideBack, sfx, resumeRound } from '../lib/core.js';

const COL = { red: '#ef476f', yellow: '#ffd166', green: '#06d6a0', blue: '#118ab2', purple: '#9b5de5' };
const SHAPES = ['circle', 'square', 'triangle', 'star'];
const PLURAL = { circle: 'circles', square: 'squares', triangle: 'triangles', star: 'stars' };
const key = (p) => `${p.col}-${p.shape}`;
const lab = (p) => `${p.col} ${p.shape}`;
const ALLP = Object.keys(COL).flatMap((col) => SHAPES.map((shape) => ({ col, shape })));
const TOTAL = 5; // rounds in the game
const NUMW = { 3: 'three', 4: 'four' };
const ATTR = { col: 'colour', shape: 'shape' };
const other = (a) => (a === 'col' ? 'shape' : 'col');
const DRAG_THRESHOLD = 10; // px a pointer must travel before a press counts as a drag, not a tap
const DROP_TOLERANCE = 0.95; // a drag drops into the hole when within this many cell-widths of its centre
const CHEER_OPEN = ['Yes!', 'Lovely!', 'You found it!', 'Well done!', 'Perfect fit!'];

// Pick k distinct colours; never red together with green.
function colourSet(k) {
  let s;
  do {
    s = shuffle(Object.keys(COL)).slice(0, k);
  } while (s.includes('red') && s.includes('green')); // colour-blind friendly
  return s;
}

// ---------- puzzle generation (pure logic) ----------
const latin = (g, attr, pal) => {
  const n = g.length;
  const ok = (cells) =>
    cells.length === n && new Set(cells.map((x) => x[attr])).size === n && cells.every((x) => pal.includes(x[attr]));
  for (let i = 0; i < n; i++) {
    if (!ok(g[i])) return false;
    if (!ok(g.map((row) => row[i]))) return false;
  }
  return true;
};
const lineSame = (cells, attr) => cells.every((x) => x[attr] === cells[0][attr]);

// Build one random puzzle for the round (0..4); makePuzzle() keeps only ones that verify().
function build(round) {
  const hole = { r: 0, c: 0 };
  let n = 2,
    grid,
    rule,
    answer,
    choices,
    info = {};
  if (round === 0) {
    const cs = colourSet(2),
      ss = shuffle(SHAPES).slice(0, 2);
    const ra = pick(['col', 'shape']); // attribute that is the same along each row
    grid = [0, 1].map((r) =>
      [0, 1].map((c) => (ra === 'col' ? { col: cs[r], shape: ss[c] } : { col: cs[c], shape: ss[r] })),
    );
    rule = (g) =>
      g.every((row) => lineSame(row, ra)) &&
      [0, 1].every((c) =>
        lineSame(
          g.map((row) => row[c]),
          other(ra),
        ),
      );
    info = { ra };
    hole.r = rand(2);
    hole.c = rand(2);
    answer = { ...grid[hole.r][hole.c] };
    choices = cs.flatMap((col) => ss.map((shape) => ({ col, shape })));
  } else if (round === 1) {
    n = 3;
    const vary = pick(['shape', 'col']);
    const pal = vary === 'col' ? colourSet(3) : shuffle(SHAPES).slice(0, 3);
    const fix = vary === 'col' ? pick(SHAPES) : pick(Object.keys(COL));
    const [a, b] = pick([
      [1, 1],
      [1, 2],
    ]);
    const mk = (v) => (vary === 'col' ? { col: v, shape: fix } : { col: fix, shape: v });
    grid = [0, 1, 2].map((r) => [0, 1, 2].map((c) => mk(pal[(a * r + b * c) % 3])));
    rule = (g) => latin(g, vary, pal) && g.flat().every((x) => x[other(vary)] === fix);
    info = { vary };
    hole.r = rand(3);
    hole.c = rand(3);
    answer = { ...grid[hole.r][hole.c] };
    choices = pal.map(mk);
  } else if (round === 3) {
    n = 4;
    const vary = pick(['shape', 'col']);
    const pal = vary === 'col' ? colourSet(4) : shuffle(SHAPES);
    const fix = vary === 'col' ? pick(SHAPES) : pick(Object.keys(COL));
    const mk = (v) => (vary === 'col' ? { col: v, shape: fix } : { col: fix, shape: v });
    const rp = shuffle([0, 1, 2, 3]),
      cq = shuffle([0, 1, 2, 3]); // cyclic square with rows/columns shuffled
    grid = rp.map((r) => cq.map((c) => mk(pal[(r + c) % 4])));
    rule = (g) => latin(g, vary, pal) && g.flat().every((x) => x[other(vary)] === fix);
    info = { vary };
    hole.r = rand(4);
    hole.c = rand(4);
    answer = { ...grid[hole.r][hole.c] };
    choices = pal.map(mk);
  } else if (round === 4) {
    n = 4;
    const cp = colourSet(4),
      sp = shuffle(SHAPES);
    const M2 = [0, 2, 3, 1]; // multiply by 2 in GF(4): (r+c, 2r+c) are orthogonal Latin squares
    const rp = shuffle([0, 1, 2, 3]),
      cq = shuffle([0, 1, 2, 3]);
    grid = rp.map((r) => cq.map((c) => ({ col: cp[r ^ c], shape: sp[M2[r] ^ c] })));
    rule = (g) => latin(g, 'col', cp) && latin(g, 'shape', sp);
    hole.r = rand(4);
    hole.c = rand(4);
    answer = { ...grid[hole.r][hole.c] };
    const wc = shuffle(cp.filter((x) => x !== answer.col)),
      ws = shuffle(sp.filter((x) => x !== answer.shape));
    choices = [
      answer,
      { col: answer.col, shape: ws[0] },
      { col: wc[0], shape: answer.shape },
      { col: wc[1], shape: ws[1] },
    ];
  } else {
    n = 3;
    const cp = colourSet(3),
      sp = shuffle(SHAPES).slice(0, 3);
    let p, q, p2, q2;
    do {
      [p, q, p2, q2] = [1 + rand(2), 1 + rand(2), 1 + rand(2), 1 + rand(2)];
    } while ((((p * q2 - q * p2) % 3) + 3) % 3 === 0);
    grid = [0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => ({ col: cp[(p * r + q * c) % 3], shape: sp[(p2 * r + q2 * c) % 3] })),
    );
    rule = (g) => latin(g, 'col', cp) && latin(g, 'shape', sp);
    hole.r = rand(3);
    hole.c = rand(3);
    answer = { ...grid[hole.r][hole.c] };
    const wc = shuffle(cp.filter((x) => x !== answer.col)),
      ws = shuffle(sp.filter((x) => x !== answer.shape));
    choices = [
      answer,
      { col: answer.col, shape: ws[0] },
      { col: wc[0], shape: answer.shape },
      { col: wc[1], shape: ws[1] },
    ];
  }
  grid = grid.map((row) => row.map((x) => ({ ...x })));
  return { round, n, grid, hole, answer, choices: shuffle(choices), rule, ...info };
}
// The grid with piece p placed in the hole.
const withPiece = (puz, p) =>
  puz.grid.map((row, r) => row.map((x, c) => (r === puz.hole.r && c === puz.hole.c ? p : x)));
// The answer must be the ONLY piece (out of all 20 colour x shape pieces) that satisfies the rule;
// exactly one choice is it, and every other choice breaks the rule.
function verify(puz) {
  const sols = ALLP.filter((p) => puz.rule(withPiece(puz, p)));
  if (sols.length !== 1 || key(sols[0]) !== key(puz.answer)) return false;
  if (new Set(puz.choices.map(key)).size !== puz.choices.length) return false;
  if (puz.choices.filter((p) => key(p) === key(puz.answer)).length !== 1) return false;
  return puz.choices.every((p) => key(p) === key(puz.answer) || !puz.rule(withPiece(puz, p)));
}
function makePuzzle(round) {
  for (let i = 0; i < 100; i++) {
    const p = build(round);
    if (verify(p)) return p;
  }
  throw new Error('could not build a valid puzzle');
}

// ---------- drawing ----------
function starPoints() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? 18 : 42,
      a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(50 + rad * Math.cos(a)).toFixed(1)},${(54 + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
function pieceSvg(p) {
  const at = { fill: COL[p.col], stroke: '#2b2d42', 'stroke-width': 5, 'stroke-linejoin': 'round' };
  let node;
  if (p.shape === 'circle') node = h('circle', { cx: 50, cy: 50, r: 36, ...at });
  else if (p.shape === 'square') node = h('rect', { x: 15, y: 15, width: 70, height: 70, rx: 10, ...at });
  else if (p.shape === 'triangle') node = h('polygon', { points: '50,13 91,85 9,85', ...at });
  else node = h('polygon', { points: starPoints(), ...at });
  return h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, node);
}

// ---------- styles ----------
const CSS = `
.a-missing-shape{width:100%;max-width:560px;display:flex;flex-direction:column;align-items:center;gap:18px}
.a-missing-shape .board{--cs:clamp(62px,19vw,98px);display:grid;grid-template-columns:repeat(var(--n),var(--cs));gap:clamp(6px,2vw,10px);padding:clamp(8px,2.5vw,14px);background:#fff;border:3px solid var(--ink);border-radius:24px;box-shadow:var(--shadow);max-width:100%}
.a-missing-shape .board.n2{--cs:clamp(80px,27vw,124px)}
.a-missing-shape .board.n4{--cs:clamp(60px,19vw,88px)}
.a-missing-shape .cell{width:var(--cs);height:var(--cs);border-radius:16px;background:#fdf3d6;display:grid;place-items:center;position:relative;transition:background .25s,box-shadow .25s}
.a-missing-shape .cell svg{width:84%;height:84%;display:block}
.a-missing-shape .cell.hole{background:#fff;border:3px dashed var(--ink);animation:a-ms-pulse 1.6s ease-in-out infinite}
.a-missing-shape .cell.hole.done{border:0;animation:none;background:#fdf3d6}
.a-missing-shape .cell .q{font-size:calc(var(--cs)*.5);font-weight:900;opacity:.4;line-height:1}
.a-missing-shape .cell.hl{background:#ffe9a8;box-shadow:0 0 0 4px var(--orange)}
.a-missing-shape .tray{display:flex;gap:clamp(8px,2.5vw,16px);flex-wrap:wrap;justify-content:center;padding:clamp(8px,2.5vw,14px);background:#fff;border:3px solid var(--ink);border-radius:24px;max-width:100%;min-height:calc(56px + 24px)}
.a-missing-shape .opt.choice{position:relative;width:clamp(64px,17.5vw,92px);height:clamp(64px,17.5vw,92px);min-width:56px;min-height:56px;padding:0;touch-action:none;display:grid;place-items:center}
.a-missing-shape .opt svg{width:80%;height:80%;pointer-events:none;display:block}
.a-missing-shape .opt.glow{background:var(--yellow)}
.a-missing-shape .opt:focus-visible{outline:4px solid var(--blue);outline-offset:2px}
.a-missing-shape .tray.off .opt{pointer-events:none}
.a-missing-shape .tray.off .opt:not(.picked){opacity:.35}
@keyframes a-ms-pulse{50%{box-shadow:0 0 0 5px rgba(255,209,102,.95)}}
`;

export default {
  id: 'missing-shape',
  rounds: TOTAL,
  parentNote:
    'The grid follows a hidden rule, and every row and column helps you find the missing piece; later rounds grow to four by four and let colour and shape change together. Ask "What do you notice about this row?" before she chooses. A common slip is picking a piece already in the same row, so run a finger along the row and column together.',
  _make: makePuzzle, // test hook

  async start(api) {
    let alive = true;
    let round = 0,
      tok = 0,
      wrong = 0;
    let solved = false,
      busy = false,
      demoing = false;
    let puz = null,
      cells = [],
      holeEl = null,
      opts = [];
    api.css(CSS);

    const board = h('div', { class: 'board', role: 'group', 'aria-label': 'Pattern grid' });
    const tray = h('div', { class: 'tray', role: 'group', 'aria-label': 'Pieces to choose from' });
    const wrap = h('div', { class: 'a-missing-shape' }, board, tray);
    api.root.append(wrap);

    const live = (t) => alive && t === tok;
    const lineCells = (kind, i) => cells.filter((x) => (kind === 'row' ? x.r === i : x.c === i));
    const clearHl = () => cells.forEach((x) => x.el.classList.remove('hl', 'shake'));
    const setHl = (list) => {
      clearHl();
      list.forEach((x) => x.el.classList.add('hl'));
    };
    const rowName = (r) =>
      (puz.n === 2
        ? ['Top', 'Bottom']
        : puz.n === 3
          ? ['Top', 'Middle', 'Bottom']
          : ['Top', 'Second', 'Third', 'Bottom'])[r];
    const colName = (c) =>
      (puz.n === 2
        ? ['Left', 'Right']
        : puz.n === 3
          ? ['Left', 'Middle', 'Right']
          : ['Left', 'Second', 'Third', 'Right'])[c];

    function promptText() {
      if (puz.round === 0) return 'Which piece fits in the empty square?';
      if (puz.round === 1)
        return `Every row has all three ${puz.vary === 'shape' ? 'shapes' : 'colours'}. Which is missing?`;
      if (puz.round === 3)
        return `Every row has all four ${puz.vary === 'shape' ? 'shapes' : 'colours'}. Which is missing?`;
      if (puz.round === 4) return 'Four colours, four shapes. Find the missing piece.';
      return 'Find the piece with the missing colour and shape.';
    }
    function ruleText() {
      if (puz.round === 0)
        return puz.ra === 'col'
          ? 'Rows match in colour, columns match in shape.'
          : 'Rows match in shape, columns match in colour.';
      if (puz.round === 1) return `Now every row has all three ${puz.vary === 'shape' ? 'shapes' : 'colours'}.`;
      if (puz.round === 3) return `Every row has all four ${puz.vary === 'shape' ? 'shapes' : 'colours'}.`;
      if (puz.round === 4) return 'Each row has all four colours and all four shapes.';
      return 'Each row has every colour and every shape once.';
    }

    // ---------- round set-up ----------
    function setup(i, quiet) {
      tok++;
      round = i;
      wrong = 0;
      solved = false;
      busy = false;
      puz = makePuzzle(i);
      api.stage(i, TOTAL);
      board.replaceChildren();
      tray.replaceChildren();
      tray.classList.remove('off');
      board.className = `board n${puz.n}`;
      board.style.setProperty('--n', puz.n);
      cells = [];
      for (let r = 0; r < puz.n; r++)
        for (let c = 0; c < puz.n; c++) {
          const isHole = r === puz.hole.r && c === puz.hole.c;
          const p = puz.grid[r][c];
          const el = isHole
            ? h(
                'div',
                { class: 'cell hole', role: 'img', 'aria-label': 'Empty square' },
                h('span', { class: 'q', 'aria-hidden': 'true' }, '?'),
              )
            : h('div', { class: 'cell', role: 'img', 'aria-label': lab(p) }, pieceSvg(p));
          board.append(el);
          const rec = { r, c, el, p, isHole };
          cells.push(rec);
          if (isHole) holeEl = el;
        }
      opts = puz.choices.map((p) => {
        const b = h('button', { class: 'chip choice opt', type: 'button', 'aria-label': lab(p) }, pieceSvg(p));
        wire(b, p);
        tray.append(b);
        return { p, b };
      });
      if (!quiet) api.prompt(promptText());
    }

    // tap = fly into the hole; drag = carry it there (forgiving drop distance)
    function wire(b, p) {
      let st = null;
      b.addEventListener('pointerdown', (e) => {
        if (busy || solved || demoing || (e.button != null && e.button > 0)) return;
        e.preventDefault();
        st = { x: e.clientX, y: e.clientY, moved: false };
        b.setPointerCapture?.(e.pointerId);
        b.style.transition = 'none';
        b.style.zIndex = 50;
      });
      b.addEventListener('pointermove', (e) => {
        if (!st) return;
        const dx = e.clientX - st.x,
          dy = e.clientY - st.y;
        if (!st.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) st.moved = true;
        if (st.moved) {
          b.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
          b._dragPos = { x: dx, y: dy };
        }
      });
      const end = (e, cancelled) => {
        if (!st) return;
        const s = st;
        st = null;
        b.releasePointerCapture?.(e.pointerId);
        if (!s.moved) {
          b.style.zIndex = '';
          b.style.transition = '';
          if (!cancelled) tryPiece(p, b);
          return;
        }
        const hr = holeEl.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (hr.left + hr.width / 2), e.clientY - (hr.top + hr.height / 2));
        if (!cancelled && d < hr.width * DROP_TOLERANCE) tryPiece(p, b);
        else {
          b._dragBase = null;
          glideBack(b);
          b._dragPos = null;
        }
      };
      b.addEventListener('pointerup', (e) => end(e, false));
      b.addEventListener('pointercancel', (e) => end(e, true));
      b.addEventListener('click', (e) => {
        if (e.detail === 0) tryPiece(p, b);
      }); // keyboard
    }

    function fillHole(btn) {
      const rec = cells.find((x) => x.isHole);
      rec.el.replaceChildren(pieceSvg(puz.answer));
      rec.el.classList.add('done');
      rec.el.setAttribute('aria-label', lab(puz.answer));
      rec.el.classList.add('hop');
      btn.classList.add('picked');
      btn.style.visibility = 'hidden';
      tray.classList.add('off');
      opts.forEach((o) => o.b.classList.remove('glow'));
      clearHl();
    }

    async function tryPiece(p, btn) {
      if (busy || solved || demoing) return;
      busy = true;
      const t = tok;
      clearHl();
      sfx('tap');
      await flyTo(btn, holeEl, { duration: 350 });
      if (!live(t)) return;
      if (key(p) === key(puz.answer)) {
        solved = true;
        sfx('good');
        fillHole(btn);
        await Promise.race([Promise.resolve(api.cheer(`${pick(CHEER_OPEN)} ${ruleText()}`)), sleep(5000)]);
        if (!live(t)) return;
        await sleep(700);
        if (!live(t)) return;
        if (round < TOTAL - 1) setup(round + 1);
        else api.finish();
        return;
      }
      sfx('oops');
      holeEl.classList.add('shake');
      wrong++;
      giveHint(p);
      await sleep(550);
      if (!live(t)) return;
      holeEl.classList.remove('shake');
      btn._dragBase = null;
      btn._dragPos = null;
      glideBack(btn);
      busy = false;
    }

    function giveHint(p) {
      const a = puz.answer,
        hr = puz.hole.r,
        hc = puz.hole.c;
      const row = lineCells('row', hr),
        col = lineCells('col', hc);
      let text;
      if (puz.round === 0) {
        const ra = puz.ra,
          ca = other(ra);
        const badR = p[ra] !== a[ra],
          badC = p[ca] !== a[ca];
        if (badR && badC) {
          setHl([...row, ...col]);
          text = `Check this row for ${ATTR[ra]} and this column for ${ATTR[ca]}.`;
        } else if (badR) {
          setHl(row);
          text = `Look along this row. What ${ATTR[ra]} is it?`;
        } else {
          setHl(col);
          text = `Look down this column. What ${ATTR[ca]} is it?`;
        }
      } else if (puz.round === 1 || puz.round === 3) {
        const v = puz.vary;
        setHl(row);
        row.filter((x) => !x.isHole && x.p[v] === p[v]).forEach((x) => x.el.classList.add('shake'));
        text =
          v === 'shape' ? `There is already a ${p.shape} in this row.` : `There is already a ${p.col} one in this row.`;
      } else {
        setHl(row);
        const dupC = p.col !== a.col,
          dupS = p.shape !== a.shape;
        row
          .filter((x) => !x.isHole && ((dupC && x.p.col === p.col) || (dupS && x.p.shape === p.shape)))
          .forEach((x) => x.el.classList.add('shake'));
        if (dupC && dupS) text = 'That colour and that shape are both in this row.';
        else if (dupC) text = `Right shape! But a ${p.col} one is in this row.`;
        else text = `Right colour! But a ${p.shape} is in this row.`;
      }
      if (wrong >= 2) {
        const o = opts.find((x) => key(x.p) === key(a));
        o?.b.classList.add('glow');
        text = 'Try the piece that is glowing!';
      }
      api.nudge(text);
    }

    // ---------- demo ----------
    // Narrated walk-through: hop along each row (then the hole's column), name the missing piece, fly it in.
    api.setDemo(async () => {
      demoing = true;
      setup(round, true);
      const t = tok;
      const ok = () => alive && tok === t;
      const a = puz.answer,
        n = puz.n,
        hr = puz.hole.r,
        hc = puz.hole.c;
      const line = (kind, i) => lineCells(kind, i);
      const known = (kind, i) => line(kind, i).filter((x) => !x.isHole);
      const speak = (text, ms) => Promise.all([Promise.resolve(api.prompt(text)), sleep(ms)]);
      async function walk(kind, i, text, ms = 2200) {
        const cs = line(kind, i);
        setHl(cs);
        const hop = (async () => {
          for (const x of cs) {
            if (!ok()) return;
            x.el.classList.add('hop');
            sfx('tick');
            await sleep(420);
            x.el.classList.remove('hop');
          }
        })();
        await Promise.all([speak(text, ms), hop]);
        if (ok()) clearHl();
      }
      const allOf = (attr, v) => (attr === 'col' ? `all ${v}` : `all ${PLURAL[v]}`);
      const needOf = (attr, v) => (attr === 'col' ? v : `a ${v}`);

      await speak('Let us look at each row.', 1500);
      if (!ok()) return;

      if (puz.round === 0) {
        const ra = puz.ra,
          ca = other(ra);
        for (let r = 0; r < n; r++) {
          const v = known('row', r)[0].p[ra];
          const extra = r === hr ? ` We need ${needOf(ra, v)}.` : '';
          await walk('row', r, `${rowName(r)} row: ${allOf(ra, v)}.${extra}`);
          if (!ok()) return;
        }
        await speak('Now look at each column.', 1400);
        if (!ok()) return;
        for (let c = 0; c < n; c++) {
          const v = known('col', c)[0].p[ca];
          const extra = c === hc ? ` We need ${needOf(ca, v)}.` : '';
          await walk('col', c, `${colName(c)} column: ${allOf(ca, v)}.${extra}`);
          if (!ok()) return;
        }
      } else if (puz.round === 1 || puz.round === 3) {
        const v = puz.vary;
        const nm = (x) => x.p[v];
        const miss = v === 'shape' ? `the ${a.shape}` : a.col;
        for (let r = 0; r < n; r++) {
          if (r !== hr)
            await walk(
              'row',
              r,
              `${rowName(r)} row: ${line('row', r).map(nm).join(', ')}. All ${NUMW[n]}!`,
              1500 + 700 * n,
            );
          else
            await walk(
              'row',
              r,
              `${rowName(r)} row has ${known('row', r).map(nm).join(' and ')}. Missing: ${miss}.`,
              2800,
            );
          if (!ok()) return;
        }
        await walk('col', hc, `The column agrees. Missing: ${miss}.`, 2300);
        if (!ok()) return;
      } else {
        const nm = (x) => lab(x.p);
        for (let r = 0; r < n; r++) {
          if (r !== hr) {
            await walk('row', r, `${rowName(r)} row: ${line('row', r).map(nm).join(', ')}.`, 1700 + 500 * n);
            if (!ok()) return;
            await speak('All different colours, all different shapes!', 2000);
          } else {
            await walk('row', r, `${rowName(r)} row has ${known('row', r).map(nm).join(' and ')}.`, 3000);
            if (!ok()) return;
            await speak(`Missing colour: ${a.col}. Missing shape: ${a.shape}.`, 2600);
          }
          if (!ok()) return;
        }
        await walk('col', hc, 'The column agrees!', 2000);
        if (!ok()) return;
      }

      const o = opts.find((x) => key(x.p) === key(a));
      o.b.classList.add('glow');
      await speak(`So ${/^[aeiou]/.test(a.col) ? 'an' : 'a'} ${lab(a)} fits!`, 1400);
      if (!ok()) return;
      sfx('pop');
      await flyTo(o.b, holeEl, { duration: 600 });
      if (!ok()) return;
      solved = true;
      sfx('good');
      fillHole(o.b);
      await Promise.race([Promise.resolve(api.cheer('It fits! Now you try.')), sleep(3500)]);
      if (!ok()) return;
      await sleep(500);
      if (!ok()) return;
      demoing = false;
      setup(round); // fresh puzzle for the child
    });

    setup(resumeRound(api, TOTAL));
    return {
      destroy() {
        alive = false;
        tok++;
      },
    };
  },
};

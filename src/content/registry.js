/**
 * The list of levels and games. This is the single source of truth for what appears on the map.
 *
 * - Games are listed in play order (easiest first). Their number on the map is their position here.
 * - Each `id` must match a file src/activities/<id>.js (checked by `npm run check`).
 * - Never change an existing id: saved progress is stored under it. To rename, see RENAMED_IDS in src/app/progress.js.
 * - To add a game use `npm run new-game -- <id> "<Title>" <level> <emoji>` (see docs/ADDING-A-GAME.md).
 * - To add a level, add it to LEVELS, to src/content/age-guide.js and give it a colour in src/styles/home.css (.lvN).
 */

// prettier-ignore
export const LEVELS = [
  { n: 1, name: 'Seeds', emoji: '🌰', blurb: 'Counting, matching and noticing' },
  { n: 2, name: 'Sprouts', emoji: '🌱', blurb: 'Shapes, sorting and patterns' },
  { n: 3, name: 'Buds', emoji: '🌷', blurb: 'Size, chance and building' },
  { n: 4, name: 'Blossoms', emoji: '🌸', blurb: 'Plans, steps and puzzles' },
  { n: 5, name: 'Fruits', emoji: '🍎', blurb: 'Big thinking puzzles' },
];

// prettier-ignore
export const ACTIVITIES = [
  // ---- Level 1: Seeds ----
  { id: 'same-or-more', level: 1, title: 'Same or More?', emoji: '🍓', blurb: 'Are there the same number of berries and baskets?' },
  { id: 'seats-for-everyone', level: 1, title: 'Seats for Everyone', emoji: '🪑', blurb: 'Give every friend one seat.' },
  { id: 'odd-one-out', level: 1, title: 'Odd One Out', emoji: '🔎', blurb: 'Which one is different? Any of them could be!' },
  { id: 'morning-order', level: 1, title: 'A Day in Order', emoji: '☀️', blurb: 'Put the pictures in the right order.' },
  // ---- Level 2: Sprouts ----
  { id: 'mirror-pegboard', level: 2, title: 'Mirror Pegboard', emoji: '🪞', blurb: 'Make the shape on the other side of the mirror.' },
  { id: 'snowflakes', level: 2, title: 'Fold, Cut, Unfold', emoji: '❄️', blurb: 'Snip the paper, then open it up.' },
  { id: 'missing-shape', level: 2, title: 'The Missing Shape', emoji: '🧩', blurb: 'Which shape fits in the empty square?' },
  { id: 'rope-rings', level: 2, title: 'Rope Rings', emoji: '⭕', blurb: 'Sort things into one ring, the other, or both.' },
  { id: 'ant-on-band', level: 2, title: 'The Ant on the Band', emoji: '🐜', blurb: 'Follow the ant around a twisty paper band.' },
  // ---- Level 3: Buds ----
  { id: 'pour-the-same', level: 3, title: 'Pour the Same', emoji: '🥛', blurb: 'Does pouring change how much there is?' },
  { id: 'dice-race', level: 3, title: 'Dice Race', emoji: '🎲', blurb: 'Which number wins more often?' },
  { id: 'build-from-picture', level: 3, title: 'Build the Picture', emoji: '🔷', blurb: 'Fit the shapes together to match.' },
  { id: 'which-room-larger', level: 3, title: 'Which Room Is Larger?', emoji: '🏠', blurb: 'Count the squares to compare rooms.' },
  { id: 'squares-grow', level: 3, title: 'Squares That Grow', emoji: '🟧', blurb: 'Add a corner and a square gets bigger.' },
  // ---- Level 4: Blossoms ----
  { id: 'double-the-picture', level: 4, title: 'Make It Twice as Big', emoji: '🖼️', blurb: 'Copy the drawing, but bigger.' },
  { id: 'block-chains', level: 4, title: 'Chain of Blocks', emoji: '🔗', blurb: 'Each block is different in just one way.' },
  { id: 'robot-walks', level: 4, title: 'Robot Walks to the Wall', emoji: '🤖', blurb: 'Give the robot cards to follow.' },
  { id: 'construction-foreman', level: 4, title: 'Builder Team', emoji: '🏗️', blurb: 'What must be built first?' },
  { id: 'tower-of-hanoi', level: 4, title: 'Tower of Hanoi', emoji: '🗼', blurb: 'Move the tower, one disc at a time.' },
  { id: 'ways-to-make-5', level: 4, title: 'Ways to Make Five', emoji: '🪙', blurb: 'Pay the gate with different coins.' },
  // ---- Level 5: Fruits ----
  { id: 'wolf-goat-cabbage', level: 5, title: 'Wolf, Goat and Cabbage', emoji: '⛵', blurb: 'Get everyone across the river safely.' },
  { id: 'necklaces', level: 5, title: 'Necklace Makers', emoji: '📿', blurb: 'Find every necklace with 2 blue and 3 white beads.' },
  { id: 'shoes-in-dark', level: 5, title: 'Shoes in the Dark', emoji: '👟', blurb: 'How many must you grab to get a pair?' },
  { id: 'wrong-labels', level: 5, title: 'All the Labels Are Wrong', emoji: '🏷️', blurb: 'Every tag is wrong. Which box is which?' },
];

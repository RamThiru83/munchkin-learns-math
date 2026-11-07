// Rhymes and songs (decision 0010). All words are original.
// RHYMES: four short lines chanted over the level's tune before a game starts (one per game).
// SONGS: the finish song for each level, with a move to do (clap, wiggle, jump, spin, dance).
// Keep each line under about eight words so it fits two bars of the tune. Every line is recorded
// in the narrator's voice (audio/voice/songs.bin, made by scripts/voice/songs.mjs).

export const RHYMES = {
  'same-or-more': [
    'Berries up top, baskets below.',
    'Same or more? I want to know!',
    'Pair them up, one by one.',
    'Matching berries, that is fun!',
  ],
  'seats-for-everyone': [
    'Friends are coming, one, two, three.',
    'Find a seat for you and me!',
    'One friend, one chair, that’s the way.',
    'Nobody left out of play!',
  ],
  'number-path-race': [
    'Roll the dice and hop along.',
    'Count each square and sing this song!',
    'One, two, three, four, five.',
    'Hop, hop, hop, and then arrive!',
  ],
  'quick-peek': [
    'Peek-a-boo, the dots are new!',
    'Take a look, a quick look too!',
    'Blink your eyes, what did you see?',
    'Fives and tens help you and me!',
  ],
  'odd-one-out': [
    'Look at all, then look at one.',
    'Which is different? Find the one!',
    'Colour, shape, or size, or more.',
    'Tell me why, that’s what eyes are for!',
  ],
  'morning-order': [
    'Wake up, sunshine, rise and shine!',
    'Put the pictures all in line.',
    'What comes first and what comes next?',
    'Morning order, you’re the best!',
  ],
  'mirror-pegboard': [
    'Mirror, mirror, in the middle.',
    'Flip the shape and solve the riddle!',
    'Same far here, same far there.',
    'Twin shapes make a perfect pair!',
  ],
  'hidden-beads': [
    'Beads on a string, count them all.',
    'Some hide under the cup so small!',
    'How many show? How many hide?',
    'Find the beads tucked safe inside!',
  ],
  snowflakes: [
    'Fold the paper, snip, snip, snip!',
    'Open it up with a flip, flip, flip!',
    'Every cut will copy too.',
    'A snowflake pattern, just for you!',
  ],
  'missing-shape': [
    'Rows and columns, side by side.',
    'One square’s empty, shapes can hide!',
    'Look across and look down too.',
    'Find the shape that fits for you!',
  ],
  'rope-rings': [
    'Ring for red and ring for round.',
    'Where the ropes cross, both are found!',
    'Not in either? That’s okay.',
    'Outside the rings is where they stay!',
  ],
  'teddy-sees': [
    'Teddy sits across from me.',
    'What does Teddy really see?',
    'Left is right when you turn around.',
    'Sit in Teddy’s seat, look around!',
  ],
  'ant-on-band': [
    'Little ant goes round and round.',
    'On a twisty band she’s found!',
    'One side, two sides, which is true?',
    'Snip it down the middle too!',
  ],
  'pour-the-same': [
    'Pour the juice from cup to cup.',
    'Tall and thin, it looks filled up!',
    'Is it more, or just the same?',
    'Pouring is a tricky game!',
  ],
  'equal-towers': [
    'Block on block, the towers grow.',
    'How many more? Let’s count and know!',
    'Make them equal, side by side.',
    'Bars can show it, long and wide!',
  ],
  'dice-race': [
    'Shake the dice and let them roll.',
    'Which number reaches the goal?',
    'Some come often, some do not.',
    'Which will win? Let’s give it a shot!',
  ],
  'build-from-picture': [
    'Triangles and squares to fit.',
    'Turn them round a little bit!',
    'Corner here and corner there.',
    'Build the picture, piece with care!',
  ],
  'tower-to-the-mark': [
    'Up, up, up, to reach the line!',
    'Stack the blocks and measure fine.',
    'Clips in a row, no gaps between.',
    'The best measuring you’ve seen!',
  ],
  'which-room-larger': [
    'Two little rooms with squares inside.',
    'Which is bigger? Let’s decide!',
    'Count the squares on every floor.',
    'The bigger room has squares galore!',
  ],
  'squares-grow': [
    'One small square, now watch it grow!',
    'Add an L shape, round we go.',
    'One, then four, then nine, sixteen.',
    'The biggest squares you’ve ever seen!',
  ],
  'double-the-picture': [
    'Little picture, make it big!',
    'Twice as tall, now dance a jig!',
    'Every line goes twice as long.',
    'Copy it and sing along!',
  ],
  'block-chains': [
    'Colour, shape, and size, all three.',
    'Change just one, now follow me!',
    'Block by block, the chain will grow.',
    'What has changed? I think you know!',
  ],
  'robot-walks': [
    'Beep, boop, robot friend!',
    'Walk until the very end.',
    'Step and turn, one card at a time.',
    'Plan the path and make it rhyme!',
  ],
  'construction-foreman': [
    'Hard hats on, the builders go!',
    'What comes first? We need to know.',
    'Walls go up before the roof.',
    'Plan it well, and here’s the proof!',
  ],
  'tower-of-hanoi': [
    'Pancakes stacked from big to small.',
    'Move them over, one and all!',
    'One at a time, that is the rule.',
    'Small on big is super cool!',
  ],
  'ways-to-make-5': [
    'Clink, clink, coins to pay!',
    'Many ways to pay today.',
    'Two and two and one make five.',
    'Find them all, and then high five!',
  ],
  'wolf-goat-cabbage': [
    'Wolf and goat and cabbage too.',
    'Need to cross the river blue!',
    'Who goes first and who comes back?',
    'Plan the trip and stay on track!',
  ],
  necklaces: [
    'Blue and white, the beads in rows.',
    'How many necklaces? Who knows!',
    'Slide a bead and try again.',
    'Find them all, from one to ten!',
  ],
  'shoes-in-dark': [
    'Lights are out, it’s dark in here!',
    'Grab some socks, and never fear.',
    'How many grabs to be quite sure?',
    'Find a pair, then count once more!',
  ],
  'wrong-labels': [
    'Every tag is wrong, oh my!',
    'Which box holds what? Let’s try!',
    'Peek in one and think it through.',
    'Then you’ll know the others too!',
  ],
};

/** The finish song for each level: four lines, with a move in the third (shown as a "Move!" card). */
export const SONGS = {
  1: [
    'Little seed, you did it, hooray!',
    'Counting, matching, all the way!',
    'Clap your hands and stomp your feet.',
    'Learning maths is such a treat!',
  ],
  2: [
    'Sprout, sprout, growing tall.',
    'You solved them, one and all!',
    'Wiggle left and wiggle right.',
    'Your thinking’s shining bright!',
  ],
  3: [
    'Bud, bud, ready to bloom.',
    'Big ideas fill the room!',
    'Jump up high and touch the sky.',
    'Clever thinking, way to try!',
  ],
  4: [
    'Blossoms open, one by one.',
    'Plans and puzzles, now you’re done!',
    'Spin around and take a bow.',
    'You’re a puzzle master now!',
  ],
  5: [
    'Fruits are ripe upon the tree.',
    'Big thinking, wait and see!',
    'Dance and twirl and shout hooray!',
    'You’re a thinker, hip, hip, hooray!',
  ],
};

/** The move in each finish song (third line), drawn as a little picture on the song card. */
export const MOVES = { 1: 'clap', 2: 'wiggle', 3: 'jump', 4: 'spin', 5: 'dance' };

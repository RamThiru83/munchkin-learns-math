# 0010 — Music, rhymes and sung instructions

Status: accepted (2026-11-07). Builds on 0007 (recorded voice) and 0009 (made for the child).

## Context

Ram asked for the site to feel livelier, in the spirit of Khan Academy Kids (song-based activities, movement breaks, a friendly guide), and added: "even the instructions can be sung". The narrator's voice (Chirp 3 HD) speaks but cannot truly sing, the site must stay small and work offline once loaded, and every piece of music and every word must be original.

## Decision

- **Music is synthesised in the browser** (src/lib/music.js, WebAudio): no audio files, nothing to license. Each level has its own band: Seeds ukulele (C, 100 bpm), Sprouts marimba (F, 104), Buds xylophone (G, 110), Blossoms steel drum (D, 100), Fruits bells with a funky beat (A, 112). The home page has a soft music-box tune.
- **Rhyme time:** before round 1 every game chants its own four-line original rhyme (src/content/rhymes.js) over its level's band. Each line starts on a beat, the band goes quieter under the voice, and each word lights up as it is said. "Let's play!" starts the game at any time; the game starts by itself when the rhyme ends. Not shown when resuming a game part-way.
- **Sung instructions:** with the Music switch on, every instruction a game gives (api.prompt) is chanted over a soft beat in the level's style; the owl bobs to the beat. Cheers and nudges keep their sound effects. Watch demos stay quiet.
- **Round jingle:** a one-second "ta-da" in the level's instrument when a round is done.
- **Song time:** the finish card plays the level's song (four lines) with a move to do: clap, wiggle, jump, spin, dance (a movement break). The owl does the move.
- **Recorded voice:** the 151 rhyme sentences are recorded with the same narrator (rate 1.0, a little brighter than the 0.9 of instructions) into audio/voice/songs.bin (1.2 MB) by scripts/voice/songs.mjs.
- **Switches:** a Music switch (home page top row and footer) turns off all music, the beat under instructions and the bands under rhymes; rhymes are then chanted without music. Voice off: words still light up at chanting speed.
- **Checks:** `npm run check` fails if a game has no four-line rhyme or a level no song and move, and notes any rhyme sentence not yet recorded. tests/music.spec.js covers the rhyme, Let's play, auto-start and the Music switch. Other tests skip rhymes and songs (nilaa:fasttests).

## Consequences

About 8–15 seconds more before round 1 the first time a game is opened (skippable). Text-to-speech chants rather than sings; real singing would need a singer or a singing-voice model. The 30 games' own code is unchanged: all of this lives in the frame.

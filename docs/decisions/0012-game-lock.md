# 0012 — Grown-ups can lock games

Status: accepted (2026-11-07).

## Context

Ram asked for a lock on Little Scientists Club episodes (a PIN lock went live there on 7 Nov), then: "Add the game lock in Munchkin Learns Math as well."

## Decision

- Same design as the Little Scientists Club parent lock, so a parent meets one idea on both sites: a 4-digit PIN set by a grown-up (typed twice), then a list of all 30 games by level with lock switches, Lock all / Unlock all, Change PIN, Remove PIN and all locks. "Forgot the PIN?" asks a grown-up multiplication question, then a new PIN (the locks stay).
- Entry points: "Lock games" on the For grown-ups page and in the home page footer (Settings). Not in the top row, which children use.
- Locked games: grey picture with a padlock and "Locked" on the home page; "Play next" and the finish card's "Next game" skip them; tapping one, following a link or typing #/play/<id> shows the home page and asks for the PIN; the right PIN opens it for this visit only.
- Stored in this browser only (`nilaa:lock`: salt, SHA-256 hash of salt:PIN, locked ids); nothing is sent anywhere. It is a child lock, not security: the site is static, and clearing the browser's data removes it.
- Code: src/app/lock.js; router hook in src/app/main.js; tests/lock.spec.js.

## Consequences

Another device, browser or a cleared browser has no locks. Saved stars and rounds are untouched (different keys).

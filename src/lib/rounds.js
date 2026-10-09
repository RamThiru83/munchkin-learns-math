/**
 * Round helpers for the game contract (docs/GAME-CONTRACT.md).
 *
 * resumeRound(api, total) -> zero-based round a game should start on.
 * The app sets api.resume when a child carries on from a saved round
 * (0 for a fresh start); this clamps it safely into 0..total-1.
 */
export function resumeRound(api, total) {
  return Math.max(0, Math.min(api.resume | 0, total - 1));
}

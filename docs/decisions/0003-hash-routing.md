# 0003 — Hash routing

**Status:** accepted (Oct 2026)

**Decision.** Routes are `#/`, `#/play/<id>` and `#/grownups`. They work on static hosting and from a single file with no server rewrites.

**Consequences.** In-page anchors (e.g. reference links) must scroll with JavaScript instead of changing the hash (see `refLink` in `src/app/pages/grownups.js`). Shared links to a game keep working forever as long as the id does not change.

# 0001 — Plain JavaScript, no framework

**Status:** accepted (Oct 2026)

**Context.** The site must keep working for years with occasional, part-time maintenance. Framework upgrades (React, Vue, …) are the most common cause of small projects rotting.

**Decision.** Vanilla ES modules and a 25-line DOM helper (`h()` in `src/lib/dom.js`). No runtime dependencies at all; development tools only.

**Consequences.** Nothing to upgrade at runtime; browsers keep running old JavaScript. Each game manages its own DOM, so code is a little longer than with a framework. Keep helpers in `src/lib/` small and well named.

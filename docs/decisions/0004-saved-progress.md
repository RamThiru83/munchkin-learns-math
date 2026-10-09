# 0004 — Saved progress

**Status:** accepted (Oct 2026)

**Context.** Children's stars and the round they are on are the only user data. Losing them in an update would be upsetting; there is no server.

**Decision.**
- Data lives in localStorage under the prefix `nilaa:` (from the site's first name). The prefix is **never** renamed.
- `src/app/progress.js` owns every key. Its shape is versioned with `schema`; changes bump `SCHEMA` and add a migration step.
- Game ids are permanent keys; renames go through `RENAMED_IDS`.
- Games never touch storage; they report rounds with `api.stage(i, n)` and completion with `api.finish()`.

**Consequences.** Progress is per browser and per device; clearing site data erases it (an export/import feature is in the backlog). Any change to `progress.js` deserves a test that loads old-format data.

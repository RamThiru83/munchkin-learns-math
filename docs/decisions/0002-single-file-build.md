# 0002 — Single-file build, GitHub Pages from the repo root

**Status:** accepted (Oct 2026)

**Context.** The site should be easy to host, to save offline, and to share. GitHub Pages is already set to serve the `main` branch root.

**Decision.** `npm run build` inlines all JS and CSS into `index.html` at the repo root, which is committed. The build is reproducible (version only, no timestamp) so CI can verify the committed file matches the source.

**Consequences.** Remember to rebuild and commit `index.html` with every source change (CI fails otherwise). The file can be emailed or opened from disk and still works. Switching to a GitHub Actions deploy later is possible (Pages setting "Source: GitHub Actions"); then `index.html` would no longer need committing.

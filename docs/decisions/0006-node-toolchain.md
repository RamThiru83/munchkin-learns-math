# 0006 — Node-only toolchain

**Status:** accepted (Oct 2026; replaces the earlier Python test scripts and shell build)

**Decision.** One toolchain: Node ≥ 20 with exact-pinned dev dependencies (esbuild, ESLint, Prettier, Playwright). `npm run verify` is the single gate before publishing; GitHub Actions runs the same commands.

**Consequences.** A maintainer needs only Node and `npm install`. Tool upgrades are deliberate (see MAINTENANCE.md). Browser tests download Chromium via `npx playwright install chromium`, or use an existing one with `CHROME=/path`.

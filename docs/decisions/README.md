# Decision records

Short notes on choices that a future maintainer might otherwise undo by accident. Add a new numbered file when you make a decision of the same kind; do not rewrite old ones — supersede them.

| # | Decision |
|---|---|
| [0001](0001-no-framework.md) | Plain JavaScript, no framework or runtime dependencies |
| [0002](0002-single-file-build.md) | Ship one self-contained `index.html`, served by GitHub Pages from the repo root |
| [0003](0003-hash-routing.md) | Hash-based routes |
| [0004](0004-saved-progress.md) | Saved progress in localStorage, versioned, prefix `nilaa:` kept forever |
| [0005](0005-game-contract.md) | One file per game behind a small `api` contract |
| [0006](0006-node-toolchain.md) | Node-only tooling: esbuild, ESLint, Prettier, Playwright |

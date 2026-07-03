# Quiet Tiles

A calm, minimalist path-connection puzzle. Connect each pair of matching
dots with a single continuous path so that every tile on the grid is
filled. No timer, no score, no fail state, no ads — just quiet,
untimed puzzle-solving.

Play it live: https://emin-dev.github.io/quiet-tiles/

## How to play

- Each grid has several colored dot pairs, each marked with a distinct
  shape/glyph and color (so the game is fully playable without relying on
  color perception).
- Drag from one dot across adjacent tiles to draw a path to its matching
  partner. Drag back over your own path to shorten it.
- Paths from different pairs can never cross or share a tile.
- The puzzle is solved once every tile on the grid is covered by exactly
  one path and every pair is connected end to end.
- There is no timer, no move limit, and no penalty for backtracking —
  take as long as you like.

## Tech

Vanilla JavaScript (ES modules), no build step, no framework, no runtime
dependencies. The game logic (`js/board.js`) is a pure, DOM-free module —
path drawing, overlap prevention, and win detection all live there and are
covered by a standalone Node test script (`scripts/test-board.mjs`).

Levels are generated procedurally and verified offline by an independent
solver/validator (`js/solver.js`) before being committed — every shipped
level is confirmed to have a genuine full-grid-covering solution. See
`scripts/verify-levels.mjs`, which re-checks every level in
`js/levels.js` and fails loudly if any level cannot be solved.

Progress (which levels are completed, and whether the full pack is
unlocked) is saved to `localStorage`. After the first page load, the game
works fully offline — no network calls are made during play.

## Monetization

**Model: one-time purchase (BUY).** Not a subscription, not ads.

- **Free tier:** levels 1–12 are playable forever, free, no account
  needed.
- **Paid tier:** a single one-time purchase ("Unlock full pack — $2.99")
  unlocks all 70 levels permanently on that device (persisted via
  `localStorage`).
- **Sandbox status: this is a demo checkout only.** The "Unlock full
  pack" button opens a modal clearly labeled "sandbox demo checkout" and
  "no real payment method is charged." Confirming it just flips a local
  `unlocked` flag in `localStorage` — there is no real payment processor,
  no Stripe/Gumroad account, and no real money ever changes hands in this
  build. This mirrors what a real one-time-purchase confirmation flow
  would do after a successful (hypothetical) checkout.
- No ads anywhere, no timers gating access, no forced waiting.

## Project structure

```
index.html          — single-page app shell (level select + game view)
css/style.css        — mobile-first styling, 48px+ touch targets, high-contrast palette
js/board.js          — core puzzle engine: path drawing, overlap rules, win detection
js/solver.js         — offline solver/validator used to verify level solvability
js/levels.js         — the curated, pre-verified 70-level pack
js/palette.js        — color + shape/glyph pairing per color index (colorblind-accessible)
js/storage.js        — localStorage save/load helpers
js/app.js            — DOM controller wiring everything together
scripts/test-board.mjs     — Node test script asserting board.js's core logic
scripts/verify-levels.mjs  — Node script re-validating every shipped level via solver.js
```

## Accessibility

- All interactive controls are at least 48×48px.
- Body text is 16px or larger throughout.
- Every color pair is also distinguished by a unique glyph/shape drawn on
  its dots, so colorblind players are never dependent on color alone.
- Color palette chosen for real contrast against the light background.

// scripts/test-level-playthrough.mjs — end-to-end simulation of actually
// playing a real shipped level (not a synthetic toy grid) through the
// Board engine, using the exact solution the solver found for it. Proves
// the real level data + real engine actually reach a genuine win.
//
// Run with: node scripts/test-level-playthrough.mjs

import { Board } from "../js/board.js";
import { solve } from "../js/solver.js";
import { LEVELS } from "../js/levels.js";

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`PASS  ${msg}`); }
  else { failed++; console.error(`FAIL  ${msg}`); }
}

// Play through level 1 (free tier, smallest) and level 70 (largest paid
// level) by solving each with solver.js, then replaying that exact
// solution's moves through the real Board/extendPath API, and confirming
// board.isSolved() is true only at the very end.
for (const levelId of [1, 12, 47, 70]) {
  const def = LEVELS.find((l) => l.id === levelId);
  assert(!!def, `level ${levelId} exists in the shipped pack`);
  if (!def) continue;

  const result = solve(def.rows, def.cols, def.endpoints, { maxSteps: 3_000_000 });
  assert(result.solvable, `level ${levelId}: solver finds a real solution`);
  if (!result.solvable) continue;

  const board = new Board(def.rows, def.cols, def.endpoints);

  // Before playing anything, must not be solved.
  assert(board.isSolved() === false, `level ${levelId}: fresh board is not solved`);

  // Replay each color's solved path move-by-move through the real API.
  for (const ep of def.endpoints) {
    const solPath = result.solution.get(ep.color);
    assert(!!solPath && solPath.length >= 2, `level ${levelId} color ${ep.color}: solver produced a path`);
    for (let i = 1; i < solPath.length; i++) {
      const [r, c] = solPath[i];
      const res = board.extendPath(ep.color, r, c);
      assert(res.ok === true, `level ${levelId} color ${ep.color}: move ${i} (${r},${c}) accepted by real engine`);
    }
    assert(board.isColorConnected(ep.color) === true, `level ${levelId} color ${ep.color}: connected after replay`);
  }

  assert(board.isFullyFilled() === true, `level ${levelId}: grid fully filled after replaying the real solution`);
  assert(board.isSolved() === true, `level ${levelId}: real engine confirms WIN after replaying a genuine solution`);
}

// Negative check: replaying only HALF of a solution must NOT win.
{
  const def = LEVELS.find((l) => l.id === 1);
  const result = solve(def.rows, def.cols, def.endpoints, { maxSteps: 3_000_000 });
  const board = new Board(def.rows, def.cols, def.endpoints);
  const colors = def.endpoints.map((e) => e.color);
  // Only replay the first color fully; leave the rest untouched.
  const firstColor = colors[0];
  const solPath = result.solution.get(firstColor);
  for (let i = 1; i < solPath.length; i++) {
    board.extendPath(firstColor, solPath[i][0], solPath[i][1]);
  }
  assert(
    board.isSolved() === false,
    "level 1: partial replay (only 1 of N colors routed) correctly does NOT trigger a win"
  );
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

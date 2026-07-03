// scripts/test-board.mjs — real, assertion-based tests of the core game
// logic in js/board.js: path drawing, overlap prevention, and win
// detection. Run with: node scripts/test-board.mjs
// Exits non-zero if any assertion fails.

import { Board } from "../js/board.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`PASS  ${msg}`);
  } else {
    failed++;
    console.error(`FAIL  ${msg}`);
  }
}

function freshBoard() {
  // 2x3 grid:
  // (0,0)=A  (0,1)=.  (0,2)=B
  // (1,0)=A  (1,1)=.  (1,2)=B
  return new Board(2, 3, [
    { color: 0, cells: [[0, 0], [1, 0]] },
    { color: 1, cells: [[0, 2], [1, 2]] },
  ]);
}

// ---------- 1. Drawing a valid path succeeds ----------
{
  const b = freshBoard();
  // Path for color 0 starts at its first endpoint cell (0,0). Extend to
  // the adjacent cell (1,0), which is color 0's other endpoint.
  const step = b.extendPath(0, 1, 0);
  assert(step.ok === true, "valid adjacent extension to the other endpoint succeeds");
  assert(step.completed === true, "reaching the second endpoint marks the path completed");
  assert(b.isColorConnected(0) === true, "color 0 reports connected after direct 2-cell path");
}

// ---------- 2. Rejecting a non-adjacent jump ----------
{
  const b = freshBoard();
  const res = b.extendPath(0, 0, 2); // (0,0) -> (0,2) is not adjacent
  assert(res.ok === false && res.reason === "not-adjacent", "non-adjacent extension is rejected");
}

// ---------- 3. Rejecting drawing through a cell occupied by another color ----------
{
  const b = freshBoard();
  // Grow color 0's path through the middle column: (0,0) -> (0,1)
  const step1 = b.extendPath(0, 0, 1);
  assert(step1.ok === true, "color 0 can claim (0,1), a free middle cell");

  // Now color 1 starts at (0,2) and tries to step into (0,1), which color 0 owns.
  const step2 = b.extendPath(1, 0, 1);
  assert(
    step2.ok === false && step2.reason === "occupied-by-other",
    "drawing through a cell already owned by a different color is rejected"
  );
}

// ---------- 4. Win condition fires only when the grid is FULLY covered ----------
{
  const b = freshBoard();
  // Connect color 0 directly (0,0)-(1,0): both endpoints connected, but
  // (0,1),(0,2)... wait (0,2)/(1,2) belong to color1. Only (0,1) and (1,1)
  // are the truly "extra" free cells in this 2x3 grid.
  b.extendPath(0, 1, 0); // color0: (0,0) -> (1,0), completed, 2 cells filled
  b.extendPath(1, 1, 2); // color1: (0,2) -> (1,2), completed, 2 cells filled

  assert(b.isColorConnected(0) === true, "color 0 connected");
  assert(b.isColorConnected(1) === true, "color 1 connected");
  assert(
    b.isFullyFilled() === false,
    "grid is NOT fully filled yet — (0,1) and (1,1) remain empty"
  );
  assert(
    b.isSolved() === false,
    "win condition correctly does NOT fire when cells remain uncovered, even though both colors are connected end-to-end"
  );

  // Now genuinely cover the whole grid: redraw color 0's path to snake
  // through the middle cells too: (0,0)-(0,1)-(1,1)-(1,0)
  b.clearPath(0);
  let s;
  s = b.extendPath(0, 0, 1); assert(s.ok, "reroute color0 step 1 (0,0)->(0,1)");
  s = b.extendPath(0, 1, 1); assert(s.ok, "reroute color0 step 2 (0,1)->(1,1)");
  s = b.extendPath(0, 1, 0); assert(s.ok && s.completed, "reroute color0 step 3 (1,1)->(1,0) completes path");

  assert(b.isFullyFilled() === true, "grid IS fully filled once color0's path snakes through the middle");
  assert(
    b.isSolved() === true,
    "win condition fires once every cell is covered AND every color is connected"
  );
}

// ---------- 5. Retract (undo one step) works ----------
{
  const b = freshBoard();
  b.extendPath(0, 0, 1); // (0,0) -> (0,1)
  const before = b.getPath(0).length;
  const retract = b.extendPath(0, 0, 0); // step back onto (0,0), the previous cell
  assert(retract.ok === true && retract.retracted === true, "stepping back onto the previous cell retracts it");
  assert(b.getPath(0).length === before - 1, "path length decreases by one after retract");
  assert(b.getOwner(0, 1) === undefined, "retracted cell (0,1) is freed and has no owner");
}

// ---------- 6. Truncating by re-clicking an earlier cell in your own path ----------
{
  const b = freshBoard();
  b.extendPath(0, 0, 1); // (0,0)->(0,1)
  b.extendPath(0, 1, 1); // (0,1)->(1,1)
  const trunc = b.extendPath(0, 0, 1); // jump back to (0,1), an earlier cell in this same path (not adjacent to (1,1)!)
  // Note: (1,1) -> (0,1) IS adjacent (dr=1,dc=0), so this exercises the
  // truncate-to-earlier-point behavior instead of "not-adjacent".
  assert(trunc.ok === true, "re-selecting an earlier cell in your own path is accepted");
  assert(b.getPath(0).length === 2, "path truncates back to the re-selected cell");
  assert(b.getOwner(1, 1) === undefined, "cells beyond the truncation point are freed");
}

// ---------- 7. Cannot claim a cell that is another color's endpoint ----------
{
  const b = freshBoard();
  // color0 path at (0,0); try to step into (0,2) is not adjacent, so first
  // move it toward (0,1) then attempt (0,1)->(0,2) is adjacent — (0,2) is
  // color1's own endpoint, must be rejected.
  b.extendPath(0, 0, 1);
  const res = b.extendPath(0, 0, 2);
  assert(
    res.ok === false && res.reason === "occupied-by-other",
    "cannot claim a cell that is a different color's endpoint"
  );
}

// ---------- 8. isSolved false on a totally empty freshly constructed board ----------
{
  const b = freshBoard();
  assert(b.isSolved() === false, "a freshly constructed board (no paths drawn) is not solved");
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}

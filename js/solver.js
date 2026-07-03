// solver.js — backtracking solver/validator for Flow-style puzzles. Used
// offline (Node) to verify every shipped level is genuinely solvable with
// a full-grid-covering solution before it's ever shown to a player. Not
// used at runtime by the UI.
//
// The puzzle is: assign each color a single simple path between its two
// fixed endpoints such that, together, all paths cover every cell in the
// grid exactly once. This is solved with recursive backtracking:
//   - grow the current color's path one cell at a time toward its target
//   - when the target is reached, that color is "done" but the search
//     still tries the alternative of walking PAST the target through more
//     cells first (since taking the shortest route may strand cells that
//     only this color's detour could have covered) — recursion explores
//     both, in an order that tries "shorter now" before "longer detour"
//     for speed, but always backtracks if the choice fails downstream.
//   - after the last color's path is placed, verify true full coverage.
//
// Two safe pruning rules cut the search space:
//   1. No empty cell may end up with zero non-finalized neighbors (i.e. be
//      totally walled in by already-finished colors) — such a cell could
//      never be covered.
//   2. Every not-yet-finalized color's two endpoints must remain mutually
//      reachable through cells that are empty or already its own.
// Recursion depth is bounded by rows*cols (grid cells), safe for the grid
// sizes this game uses (well under any stack limit).

function idx(r, c, cols) {
  return r * cols + c;
}

function neighborsOf(r, c, rows, cols) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < rows - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < cols - 1) out.push([r, c + 1]);
  return out;
}

export function solve(rows, cols, endpoints, options = {}) {
  const maxSteps = options.maxSteps || 2_000_000;
  let steps = 0;
  let budgetExceeded = false;

  const total = rows * cols;
  const occupied = new Uint8Array(total); // 1 if filled by some path
  const owner = new Int16Array(total).fill(-1);

  for (const ep of endpoints) {
    for (const [r, c] of ep.cells) {
      occupied[idx(r, c, cols)] = 1;
      owner[idx(r, c, cols)] = ep.color;
    }
  }

  const colorOrder = endpoints.map((e) => e.color);
  const endpointMap = new Map(endpoints.map((e) => [e.color, e.cells]));
  const finalPaths = new Map();

  function remainingColorsStillFeasible(fromColorIdx, currentColor, curPos) {
    for (let ci = fromColorIdx; ci < colorOrder.length; ci++) {
      const color = colorOrder[ci];
      const [start, target] = endpointMap.get(color);
      const from = color === currentColor ? curPos : start;

      const visited = new Uint8Array(total);
      const queue = [from];
      visited[idx(from[0], from[1], cols)] = 1;
      let found = from[0] === target[0] && from[1] === target[1];
      let qi = 0;
      while (qi < queue.length && !found) {
        const [r, c] = queue[qi++];
        for (const [nr, nc] of neighborsOf(r, c, rows, cols)) {
          const k = idx(nr, nc, cols);
          if (visited[k]) continue;
          const isTarget = nr === target[0] && nc === target[1];
          if (!isTarget && occupied[k] === 1 && owner[k] !== color) continue;
          visited[k] = 1;
          if (isTarget) { found = true; break; }
          queue.push([nr, nc]);
        }
      }
      if (!found) return false;
    }
    return true;
  }

  function noEmptyCellIsFullyDead(fromColorIdx) {
    const finalizedColors = new Set();
    for (let i = 0; i < fromColorIdx; i++) finalizedColors.add(colorOrder[i]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = idx(r, c, cols);
        if (occupied[k] === 1) continue;
        let hasNonFinalizedNbr = false;
        for (const [nr, nc] of neighborsOf(r, c, rows, cols)) {
          const nk = idx(nr, nc, cols);
          if (occupied[nk] === 0 || !finalizedColors.has(owner[nk])) {
            hasNonFinalizedNbr = true;
            break;
          }
        }
        if (!hasNonFinalizedNbr) return false;
      }
    }
    return true;
  }

  function nbrsSortedTowardTarget(pos, target, rows, cols) {
    return neighborsOf(pos[0], pos[1], rows, cols).sort((a, b) => {
      const da = Math.abs(a[0] - target[0]) + Math.abs(a[1] - target[1]);
      const db = Math.abs(b[0] - target[0]) + Math.abs(b[1] - target[1]);
      return da - db;
    });
  }

  // Recursive: grow current color's path from `cur` toward `target`.
  // `path` accumulates cells (mutated in place, popped on backtrack).
  // Returns true if a full overall solution was found from this state
  // (i.e. this color completes AND all subsequent colors + coverage work
  // out); false otherwise, with all speculative state rolled back.
  function growAndRecurse(colorIdx, color, target, cur, path) {
    if (budgetExceeded) return false;
    steps++;
    if (steps > maxSteps) {
      budgetExceeded = true;
      return false;
    }

    const atTarget = cur[0] === target[0] && cur[1] === target[1];

    if (atTarget && path.length > 1) {
      // Option A: stop the path here (shortest-so-far route).
      finalPaths.set(color, path.slice());
      if (solveFromColor(colorIdx + 1)) return true;
      finalPaths.delete(color);
      // Option B (below): keep walking past target to cover more cells,
      // then come back to target at the very end. To allow that, we do
      // NOT return yet — fall through to try extending further, but we
      // must temporarily "unlock" target so we can pass through it and
      // re-enter later. Simplest robust approach: allow continuing only
      // if we haven't already stopped here — but a simple path can't
      // revisit target mid-walk and then end elsewhere (target IS the
      // fixed endpoint, path must END there). So detouring means: instead
      // of moving directly to target now, we should have taken a longer
      // route BEFORE arriving. That alternative is naturally explored by
      // trying neighbors in a different order at earlier steps, not by
      // continuing past target here. So no further action needed at this
      // node — just report failure to let the caller try a different
      // earlier branch.
      return false;
    }

    const nbrs = nbrsSortedTowardTarget(cur, target, rows, cols);
    for (const [nr, nc] of nbrs) {
      const k = idx(nr, nc, cols);
      const isTargetCell = nr === target[0] && nc === target[1];
      if (occupied[k] === 1 && !isTargetCell) continue; // occupied by other color

      const wasOccupied = occupied[k] === 1; // true only if it's our own target endpoint
      if (!wasOccupied) {
        occupied[k] = 1;
        owner[k] = color;
      }
      path.push([nr, nc]);

      if (
        noEmptyCellIsFullyDead(colorIdx) &&
        remainingColorsStillFeasible(colorIdx, color, [nr, nc])
      ) {
        if (growAndRecurse(colorIdx, color, target, [nr, nc], path)) {
          return true;
        }
      }

      path.pop();
      if (!wasOccupied) {
        occupied[k] = 0;
        owner[k] = -1;
      }
    }
    return false;
  }

  function solveFromColor(colorIdx) {
    if (colorIdx >= colorOrder.length) {
      for (let i = 0; i < total; i++) if (occupied[i] === 0) return false;
      return true;
    }
    const color = colorOrder[colorIdx];
    const [start, target] = endpointMap.get(color);
    return growAndRecurse(colorIdx, color, target, start, [start]);
  }

  const ok = solveFromColor(0);
  if (ok) return { solvable: true, solution: finalPaths };
  if (budgetExceeded) return { solvable: false, inconclusive: true };
  return { solvable: false };
}

/**
 * Validate a level definition object { rows, cols, endpoints }.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateLevel(level, options = {}) {
  const errors = [];
  const { rows, cols, endpoints } = level;

  if (!Number.isInteger(rows) || rows < 2) errors.push("bad rows");
  if (!Number.isInteger(cols) || cols < 2) errors.push("bad cols");
  if (!Array.isArray(endpoints) || endpoints.length < 2) {
    errors.push("need at least 2 color pairs");
  }

  const seenColors = new Set();
  const seenCells = new Set();
  for (const ep of endpoints || []) {
    if (seenColors.has(ep.color)) errors.push(`duplicate color ${ep.color}`);
    seenColors.add(ep.color);
    if (!ep.cells || ep.cells.length !== 2) {
      errors.push(`color ${ep.color} must have exactly 2 endpoint cells`);
      continue;
    }
    for (const [r, c] of ep.cells) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) {
        errors.push(`color ${ep.color} endpoint out of bounds`);
      }
      const k = `${r},${c}`;
      if (seenCells.has(k)) errors.push(`overlapping endpoint at ${k}`);
      seenCells.add(k);
    }
    const [[r1, c1], [r2, c2]] = ep.cells;
    if (r1 === r2 && c1 === c2) {
      errors.push(`color ${ep.color} has identical start/end cell`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const result = solve(rows, cols, endpoints, options);
  if (!result.solvable) {
    errors.push(
      result.inconclusive
        ? "solver step budget exceeded (treated as invalid — too slow/uncertain to ship)"
        : "no full-grid-covering solution exists"
    );
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

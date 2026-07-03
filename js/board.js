// board.js — core Flow-style puzzle engine (pure logic, no DOM).
// A Board holds a grid of cells. Each cell is either:
//   - empty (no path passes through it)
//   - an "endpoint" belonging to color c (a dot)
//   - part of a path belonging to color c (a "pipe" segment)
//
// A puzzle is solved when EVERY cell is occupied by exactly one path,
// AND for every color, its two endpoints are connected by a single
// continuous path of cells of that color (no branching, no crossing).
//
// This module is dependency-free ES module logic, importable directly
// from Node for testing and from the browser for the UI.

export function key(r, c) {
  return `${r},${c}`;
}

export class Board {
  /**
   * @param {number} rows
   * @param {number} cols
   * @param {Array<{color:number, cells:[[r,c],[r,c]]}>} endpoints
   */
  constructor(rows, cols, endpoints) {
    this.rows = rows;
    this.cols = cols;
    this.endpoints = endpoints; // list of {color, cells:[[r,c],[r,c]]}

    // cellOwner: Map key -> color (number) for any cell that is part of a
    // path (including endpoints themselves).
    this.cellOwner = new Map();
    // endpointAt: Map key -> color, marks which cells are the fixed dots.
    this.endpointAt = new Map();
    // paths: Map color -> ordered array of [r,c] from endpoint A to
    // wherever the path currently reaches (may or may not reach endpoint B).
    this.paths = new Map();

    for (const ep of endpoints) {
      for (const [r, c] of ep.cells) {
        this.endpointAt.set(key(r, c), ep.color);
        this.cellOwner.set(key(r, c), ep.color);
      }
      this.paths.set(ep.color, [ep.cells[0]]);
    }
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  isAdjacent(a, b) {
    const dr = Math.abs(a[0] - b[0]);
    const dc = Math.abs(a[1] - b[1]);
    return dr + dc === 1;
  }

  getEndpointCells(color) {
    const ep = this.endpoints.find((e) => e.color === color);
    return ep ? ep.cells : null;
  }

  getOwner(r, c) {
    return this.cellOwner.get(key(r, c));
  }

  isEndpoint(r, c) {
    return this.endpointAt.has(key(r, c));
  }

  getPath(color) {
    return this.paths.get(color) || [];
  }

  /**
   * Clear the path for a color, freeing all non-endpoint cells it used,
   * and reset it back to just its starting endpoint.
   */
  clearPath(color) {
    const path = this.paths.get(color) || [];
    for (const [r, c] of path) {
      const k = key(r, c);
      if (!this.endpointAt.has(k)) {
        this.cellOwner.delete(k);
      }
    }
    const startCell = this.getEndpointCells(color)[0];
    this.paths.set(color, [startCell]);
  }

  /**
   * Attempt to extend/redraw the path of `color` by appending cell (r,c).
   * Returns { ok: bool, reason?: string, completed?: bool }.
   *
   * Rules:
   *  - (r,c) must be in bounds.
   *  - (r,c) must be orthogonally adjacent to the last cell in the path.
   *  - If (r,c) is already the second-to-last cell in the path, this acts
   *    as "retract" (undo one step) — always allowed.
   *  - If (r,c) already belongs to a DIFFERENT color's path, rejected.
   *  - If (r,c) belongs to an endpoint of a DIFFERENT color, rejected.
   *  - If (r,c) is the OTHER endpoint of this same color, path completes.
   *  - If (r,c) is already part of THIS color's own path (not the retract
   *    case), it truncates the path back to that point (loop-avoidance),
   *    matching typical Flow UX.
   *  - Otherwise, the cell is claimed for this color's path.
   */
  extendPath(color, r, c) {
    if (!this.inBounds(r, c)) return { ok: false, reason: "out-of-bounds" };
    const path = this.paths.get(color);
    if (!path || path.length === 0) return { ok: false, reason: "no-path" };

    const last = path[path.length - 1];
    if (last[0] === r && last[1] === c) {
      return { ok: false, reason: "same-cell" };
    }

    // Retract: stepping back onto the previous cell in this path.
    if (path.length >= 2) {
      const prev = path[path.length - 2];
      if (prev[0] === r && prev[1] === c) {
        const removed = path.pop();
        const k = key(removed[0], removed[1]);
        if (!this.endpointAt.has(k)) this.cellOwner.delete(k);
        return { ok: true, retracted: true };
      }
    }

    if (!this.isAdjacent(last, [r, c])) {
      return { ok: false, reason: "not-adjacent" };
    }

    const k = key(r, c);
    const owner = this.cellOwner.get(k);
    const epColor = this.endpointAt.get(k);

    // Cell already belongs to a different color entirely -> reject.
    if (owner !== undefined && owner !== color) {
      return { ok: false, reason: "occupied-by-other" };
    }
    if (epColor !== undefined && epColor !== color) {
      return { ok: false, reason: "occupied-by-other" };
    }

    // Landing on this color's own endpoint.
    if (epColor === color) {
      const startCell = this.getEndpointCells(color)[0];
      const isStart = startCell[0] === r && startCell[1] === c;
      if (isStart && path.length === 1) {
        // clicking the start again, no-op
        return { ok: false, reason: "same-cell" };
      }
      if (!isStart) {
        // reached the far endpoint -> path completes
        path.push([r, c]);
        this.cellOwner.set(k, color);
        return { ok: true, completed: true };
      }
      return { ok: false, reason: "occupied-by-other" };
    }

    // Landing on a cell already part of this color's own path (but not an
    // endpoint) -> truncate back to that point (backtrack via re-trace).
    if (owner === color) {
      const idx = path.findIndex((p) => p[0] === r && p[1] === c);
      if (idx !== -1) {
        const removedCells = path.slice(idx + 1);
        for (const [rr, cc] of removedCells) {
          const kk = key(rr, cc);
          if (!this.endpointAt.has(kk)) this.cellOwner.delete(kk);
        }
        this.paths.set(color, path.slice(0, idx + 1));
        return { ok: true, truncated: true };
      }
    }

    // Free cell -> claim it.
    path.push([r, c]);
    this.cellOwner.set(k, color);
    return { ok: true };
  }

  /** True if this color's path currently connects both its endpoints. */
  isColorConnected(color) {
    const path = this.paths.get(color);
    if (!path || path.length < 2) return false;
    const [er1, ec1] = this.getEndpointCells(color)[1];
    const last = path[path.length - 1];
    return last[0] === er1 && last[1] === ec1;
  }

  /** True if every cell in the grid is occupied by some path. */
  isFullyFilled() {
    return this.cellOwner.size === this.rows * this.cols;
  }

  /**
   * Win condition: every color's endpoints are connected AND the whole
   * grid is filled (no empty cells left).
   */
  isSolved() {
    for (const ep of this.endpoints) {
      if (!this.isColorConnected(ep.color)) return false;
    }
    return this.isFullyFilled();
  }

  /** Count of cells currently filled (for progress display). */
  filledCount() {
    return this.cellOwner.size;
  }

  totalCells() {
    return this.rows * this.cols;
  }
}

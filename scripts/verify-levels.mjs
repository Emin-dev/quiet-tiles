// scripts/verify-levels.mjs — independent, from-scratch re-validation of
// every level shipped in js/levels.js. Run with: node scripts/verify-levels.mjs
//
// This does NOT trust however the levels were generated; it re-runs each
// one through the solver/validator from a cold start and asserts that a
// genuine full-grid-covering solution exists. Exits non-zero (and prints
// which levels failed) if anything doesn't check out — meant to be run
// before every deploy.

import { LEVELS, FREE_LEVEL_COUNT } from "../js/levels.js";
import { validateLevel } from "../js/solver.js";

let failures = 0;

console.log(`Verifying ${LEVELS.length} levels (free tier: first ${FREE_LEVEL_COUNT})...\n`);

for (const level of LEVELS) {
  const v = validateLevel(
    { rows: level.rows, cols: level.cols, endpoints: level.endpoints },
    { maxSteps: 3_000_000 }
  );
  const label = `level ${level.id} (${level.rows}x${level.cols}, ${level.endpoints.length} pairs)`;
  if (v.valid) {
    console.log(`OK   ${label}`);
  } else {
    failures++;
    console.error(`FAIL ${label}: ${v.errors.join("; ")}`);
  }
}

// Sanity checks on the pack shape itself.
const ids = LEVELS.map((l) => l.id);
const uniqueIds = new Set(ids);
if (uniqueIds.size !== LEVELS.length) {
  failures++;
  console.error("FAIL: duplicate level ids detected");
}
const sortedIds = [...ids].sort((a, b) => a - b);
for (let i = 0; i < sortedIds.length; i++) {
  if (sortedIds[i] !== i + 1) {
    failures++;
    console.error(`FAIL: level ids are not a contiguous 1..N sequence (gap at ${i + 1})`);
    break;
  }
}
if (LEVELS.length < FREE_LEVEL_COUNT) {
  failures++;
  console.error("FAIL: fewer total levels than FREE_LEVEL_COUNT");
}

console.log(`\n${LEVELS.length - failures + (failures > 0 && failures <= LEVELS.length ? 0 : 0)} checks passed, ${failures} failed.`);

if (failures > 0) {
  console.error(`\n${failures} problem(s) found — level pack is NOT verified.`);
  process.exit(1);
} else {
  console.log("\nAll levels verified solvable. Level pack is good to ship.");
  process.exit(0);
}

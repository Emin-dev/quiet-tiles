// storage.js — localStorage-backed save state. Offline-first: once the
// page has loaded once, no network is needed to keep playing or saving
// progress.

const KEY = "quiet-tiles:save:v1";

function defaultState() {
  return {
    completedLevels: [], // array of level ids (numbers) the player solved
    unlocked: false, // whether the paid full pack has been unlocked
    lastLevel: 1,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      completedLevels: Array.isArray(parsed.completedLevels)
        ? parsed.completedLevels
        : [],
      unlocked: !!parsed.unlocked,
      lastLevel: Number.isInteger(parsed.lastLevel) ? parsed.lastLevel : 1,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode / disabled) — game still
    // works for the session, progress just won't persist.
  }
}

export function markLevelComplete(levelId) {
  const state = loadState();
  if (!state.completedLevels.includes(levelId)) {
    state.completedLevels.push(levelId);
  }
  state.lastLevel = levelId;
  saveState(state);
  return state;
}

export function setUnlocked(value) {
  const state = loadState();
  state.unlocked = value;
  saveState(state);
  return state;
}

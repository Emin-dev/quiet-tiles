// app.js — UI controller wiring board.js (logic) + levels.js (content) +
// storage.js (save) + palette.js (accessible color/shape coding) to the
// DOM. Vanilla ES modules, no build step, no dependencies.

import { Board } from "./board.js";
import { LEVELS, FREE_LEVEL_COUNT } from "./levels.js";
import { colorFor } from "./palette.js";
import { loadState, markLevelComplete, setUnlocked } from "./storage.js";

const els = {
  viewLevels: document.getElementById("view-levels"),
  viewGame: document.getElementById("view-game"),
  levelGrid: document.getElementById("level-grid"),
  unlockPanel: document.getElementById("unlock-panel"),
  btnBack: document.getElementById("btn-back"),
  btnHelp: document.getElementById("btn-help"),
  btnBuy: document.getElementById("btn-buy"),
  modalHelp: document.getElementById("modal-help"),
  btnCloseHelp: document.getElementById("btn-close-help"),
  modalBuy: document.getElementById("modal-buy"),
  btnConfirmBuy: document.getElementById("btn-confirm-buy"),
  btnCancelBuy: document.getElementById("btn-cancel-buy"),
  levelLabel: document.getElementById("level-label"),
  fillProgress: document.getElementById("fill-progress"),
  boardSvg: document.getElementById("board-svg"),
  btnReset: document.getElementById("btn-reset"),
  btnNext: document.getElementById("btn-next"),
  winMessage: document.getElementById("win-message"),
};

let saveState = loadState();
let currentLevelId = null;
let board = null;
let drawingColor = null;
const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 56; // logical px per cell in the SVG viewBox

function isUnlocked(levelId) {
  return levelId <= FREE_LEVEL_COUNT || saveState.unlocked;
}

// ---------- Level select view ----------

function renderLevelGrid() {
  els.levelGrid.innerHTML = "";
  for (const level of LEVELS) {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.setAttribute("role", "listitem");
    const unlocked = isUnlocked(level.id);
    const completed = saveState.completedLevels.includes(level.id);
    if (completed) btn.classList.add("completed");
    if (!unlocked) btn.classList.add("locked");

    if (unlocked) {
      btn.textContent = String(level.id);
      btn.setAttribute("aria-label", `Level ${level.id}${completed ? ", completed" : ""}`);
      btn.addEventListener("click", () => openLevel(level.id));
    } else {
      btn.innerHTML = `<span class="lock-glyph" aria-hidden="true">&#128274;</span>`;
      btn.setAttribute("aria-label", `Level ${level.id}, locked`);
      btn.addEventListener("click", () => openModal(els.modalBuy));
    }
    els.levelGrid.appendChild(btn);
  }

  els.unlockPanel.classList.toggle("hidden-fully", saveState.unlocked);
}

function showLevelsView() {
  currentLevelId = null;
  els.viewGame.hidden = true;
  els.viewLevels.hidden = false;
  els.btnBack.hidden = true;
  renderLevelGrid();
}

// ---------- Game view ----------

function openLevel(levelId) {
  if (!isUnlocked(levelId)) {
    openModal(els.modalBuy);
    return;
  }
  const def = LEVELS.find((l) => l.id === levelId);
  if (!def) return;
  currentLevelId = levelId;
  board = new Board(def.rows, def.cols, def.endpoints);
  drawingColor = null;

  els.viewLevels.hidden = true;
  els.viewGame.hidden = false;
  els.btnBack.hidden = false;
  els.levelLabel.textContent = `Level ${levelId}`;
  els.btnNext.hidden = true;
  els.winMessage.hidden = true;

  renderBoard();
  updateProgress();
}

function cellCenter(r, c) {
  return [c * CELL + CELL / 2, r * CELL + CELL / 2];
}

function renderBoard() {
  const svg = els.boardSvg;
  svg.innerHTML = "";
  const w = board.cols * CELL;
  const h = board.rows * CELL;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  // Grid lines / cell backgrounds
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", c * CELL + 2);
      rect.setAttribute("y", r * CELL + 2);
      rect.setAttribute("width", CELL - 4);
      rect.setAttribute("height", CELL - 4);
      rect.setAttribute("rx", 8);
      rect.setAttribute("fill", "#f6f3ee");
      rect.setAttribute("data-cell", `${r},${c}`);
      svg.appendChild(rect);
    }
  }

  drawPaths();
  drawEndpoints();
}

function drawPaths() {
  // Remove old path elements
  els.boardSvg.querySelectorAll(".path-line, .path-dot").forEach((n) => n.remove());
  for (const ep of board.endpoints) {
    const path = board.getPath(ep.color);
    if (path.length < 2) continue;
    const pal = colorFor(ep.color);
    for (let i = 0; i < path.length - 1; i++) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[i + 1];
      const [x1, y1] = cellCenter(r1, c1);
      const [x2, y2] = cellCenter(r2, c2);
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "path-line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", pal.hex);
      line.setAttribute("stroke-width", CELL * 0.32);
      line.setAttribute("stroke-linecap", "round");
      els.boardSvg.insertBefore(line, els.boardSvg.querySelector(".endpoint-group"));
    }
  }
}

function drawEndpoints() {
  els.boardSvg.querySelectorAll(".endpoint-group").forEach((n) => n.remove());
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "endpoint-group");
  for (const ep of board.endpoints) {
    const pal = colorFor(ep.color);
    for (const [r, c] of ep.cells) {
      const [x, y] = cellCenter(r, c);
      const g = document.createElementNS(SVG_NS, "g");

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", CELL * 0.34);
      circle.setAttribute("fill", pal.hex);
      g.appendChild(circle);

      const glyph = document.createElementNS(SVG_NS, "text");
      glyph.setAttribute("x", x);
      glyph.setAttribute("y", y);
      glyph.setAttribute("text-anchor", "middle");
      glyph.setAttribute("dominant-baseline", "central");
      glyph.setAttribute("font-size", CELL * 0.26);
      glyph.setAttribute("fill", "#ffffff");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = pal.glyph;
      g.appendChild(glyph);

      group.appendChild(g);
    }
  }
  els.boardSvg.appendChild(group);
}

function cellFromEvent(evt) {
  const rect = els.boardSvg.getBoundingClientRect();
  const point = evt.touches ? evt.touches[0] : evt;
  const scaleX = board.cols * CELL / rect.width;
  const scaleY = board.rows * CELL / rect.height;
  const x = (point.clientX - rect.left) * scaleX;
  const y = (point.clientY - rect.top) * scaleY;
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (!board.inBounds(r, c)) return null;
  return [r, c];
}

let pointerActive = false;

// Pointer handlers are attached ONCE to the persistent <svg> element (see
// bottom of file). `board` is read fresh on every event so switching
// levels (which reassigns the module-level `board` variable) just works
// without needing to re-attach listeners each time — attaching them again
// per level-open would stack duplicate listeners on the same DOM node.
function handleStart(evt) {
  if (!board) return;
  const cell = cellFromEvent(evt);
  if (!cell) return;
  const [r, c] = cell;
  const owner = board.getOwner(r, c);
  const epColor = board.isEndpoint(r, c) ? owner : undefined;
  if (epColor === undefined) return; // must start a stroke on an endpoint
  pointerActive = true;
  drawingColor = epColor;
  evt.preventDefault();
}

function handleMove(evt) {
  if (!board || !pointerActive || drawingColor === null) return;
  const cell = cellFromEvent(evt);
  if (!cell) return;
  const [r, c] = cell;
  const result = board.extendPath(drawingColor, r, c);
  if (result.ok) {
    drawPaths();
    updateProgress();
    checkWin();
  }
  evt.preventDefault();
}

function handleEnd() {
  pointerActive = false;
  drawingColor = null;
}

function attachPointerHandlers() {
  const svg = els.boardSvg;
  svg.addEventListener("mousedown", handleStart);
  svg.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleEnd);
  svg.addEventListener("touchstart", handleStart, { passive: false });
  svg.addEventListener("touchmove", handleMove, { passive: false });
  svg.addEventListener("touchend", handleEnd);
  svg.addEventListener("touchcancel", handleEnd);
}

function updateProgress() {
  els.fillProgress.textContent = `${board.filledCount()} / ${board.totalCells()} tiles`;
}

function checkWin() {
  if (board.isSolved()) {
    saveState = markLevelComplete(currentLevelId);
    els.winMessage.hidden = false;
    const hasNext = LEVELS.some((l) => l.id === currentLevelId + 1);
    els.btnNext.hidden = !hasNext;
  }
}

function resetLevel() {
  if (!board) return;
  for (const ep of board.endpoints) {
    board.clearPath(ep.color);
  }
  els.winMessage.hidden = true;
  els.btnNext.hidden = true;
  drawPaths();
  updateProgress();
}

// ---------- modals ----------

function openModal(modal) {
  modal.hidden = false;
}
function closeModal(modal) {
  modal.hidden = true;
}

// ---------- sandbox purchase flow ----------

function confirmPurchase() {
  // SANDBOX DEMO ONLY: no real payment processor is involved. This just
  // flips the local unlock flag, simulating what a real one-time-purchase
  // confirmation would do after a successful checkout.
  saveState = setUnlocked(true);
  closeModal(els.modalBuy);
  if (els.viewLevels.hidden === false) renderLevelGrid();
}

// ---------- wiring ----------

els.btnBack.addEventListener("click", showLevelsView);
els.btnHelp.addEventListener("click", () => openModal(els.modalHelp));
els.btnCloseHelp.addEventListener("click", () => closeModal(els.modalHelp));
els.btnBuy.addEventListener("click", () => openModal(els.modalBuy));
els.btnCancelBuy.addEventListener("click", () => closeModal(els.modalBuy));
els.btnConfirmBuy.addEventListener("click", confirmPurchase);
els.btnReset.addEventListener("click", resetLevel);
els.btnNext.addEventListener("click", () => {
  if (currentLevelId !== null) openLevel(currentLevelId + 1);
});

attachPointerHandlers();
showLevelsView();

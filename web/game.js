/**
 * Sliding Puzzle
 * File: web/game.js
 * Author: Kevin Thomas
 * Date: 2026-11-08
 *
 * MIT License, see the LICENSE file for the full text.
 *
 * Loads the Rust compiled WebAssembly module and draws the board.
 */

const SIZE = 4;
const CELLS = SIZE * SIZE;
const BLANK = 0;
const OUT_OF_RANGE = 255;
const WASM_FILE = "puzzle.wasm";
const CREDITS_FILE = "photos/credits.json";

const boardEl = document.querySelector("#board");
const movesEl = document.querySelector("#moves");
const timeEl = document.querySelector("#time");
const statusEl = document.querySelector("#status");
const shuffleEl = document.querySelector("#shuffle");

let api = null;
let tiles = [];
let photos = [];
let currentPhoto = "";
let startedAt = 0;
let ticker = 0;

/**
 * Fetches and instantiates the WebAssembly module.
 * @returns {Promise<object>} The exported functions of the module.
 * @throws {Error} When the file cannot be fetched or compiled.
 */
async function loadWasm() {
  const response = await fetch(WASM_FILE);
  if (!response.ok) {
    throw new Error(`puzzle.wasm returned status ${response.status}`);
  }
  try {
    const result = await WebAssembly.instantiateStreaming(response, {});
    return result.instance.exports;
  } catch (streamError) {
    const retry = await fetch(WASM_FILE);
    const buffer = await retry.arrayBuffer();
    const result = await WebAssembly.instantiate(buffer, {});
    return result.instance.exports;
  }
}

/**
 * Reads the list of bundled photographs.
 * @returns {Promise<Array<object>>} Photo records, empty when unavailable.
 */
async function loadPhotos() {
  try {
    const response = await fetch(CREDITS_FILE);
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.photos) ? payload.photos : [];
  } catch (error) {
    console.warn("photo list unavailable, showing numbers", error);
    return [];
  }
}

/**
 * Positions one tile slice over the shared photograph.
 * @param {HTMLElement} tile The tile element being built.
 * @param {number} value The tile number, one to fifteen.
 * @returns {void}
 */
function setSlice(tile, value) {
  const cell = value - 1;
  const column = cell % SIZE;
  const row = Math.floor(cell / SIZE);
  const x = (column * 100) / (SIZE - 1);
  const y = (row * 100) / (SIZE - 1);
  const face = tile.firstElementChild;
  face.style.backgroundPosition = `${x}% ${y}%`;
}

/**
 * Builds the fifteen movable tiles once at start up.
 * @returns {void}
 */
function createTiles() {
  const fragment = document.createDocumentFragment();
  tiles = [];
  for (let value = 1; value < CELLS; value += 1) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.innerHTML = `<span data-value="${value}"></span>`;
    setSlice(tile, value);
    fragment.append(tile);
    tiles[value] = tile;
  }
  boardEl.append(fragment);
}

/**
 * Chooses a photograph and applies it to every tile.
 * @returns {string} The title of the chosen photograph.
 */
function applyPhoto() {
  if (photos.length === 0) {
    boardEl.classList.add("numbers");
    return "Numbered tiles";
  }
  let index = Math.floor(Math.random() * photos.length);
  const chosen = photos[index];
  if (photos.length > 1 && chosen.file === currentPhoto) {
    index = (index + 1) % photos.length;
  }
  currentPhoto = photos[index].file;
  const loaded = new Image();
  loaded.src = `photos/${currentPhoto}`;
  boardEl.style.setProperty("--photo", `url("photos/${currentPhoto}")`);
  return photos[index].title || "Untitled";
}

/**
 * Moves a tile element to a cell through its CSS custom properties.
 * @param {HTMLElement} tile The tile element to move.
 * @param {number} index The row-major cell index.
 * @returns {void}
 */
function place(tile, index) {
  tile.style.setProperty("--x", String(index % SIZE));
  tile.style.setProperty("--y", String(Math.floor(index / SIZE)));
}

/**
 * Draws the current board state and the move counter.
 * @returns {void}
 */
function render() {
  for (let index = 0; index < CELLS; index += 1) {
    const value = api.puzzle_tile(index);
    if (value === BLANK || value === OUT_OF_RANGE) {
      continue;
    }
    const tile = tiles[value];
    if (tile) {
      place(tile, index);
    }
  }
  movesEl.textContent = String(api.puzzle_moves());
}

/**
 * Converts a tap position into a cell index.
 * @param {PointerEvent|MouseEvent} event The tap event.
 * @returns {number} The cell index, or -1 when outside the board.
 */
function indexFromPoint(event) {
  const rect = boardEl.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * SIZE);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return -1;
  }
  return y * SIZE + x;
}

/**
 * Formats a duration in seconds as minutes and seconds.
 * @param {number} totalSeconds The elapsed seconds.
 * @returns {string} The duration as m:ss.
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Refreshes the elapsed time readout.
 * @returns {void}
 */
function updateClock() {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  timeEl.textContent = formatTime(elapsed);
}

/**
 * Starts the game clock.
 * @returns {void}
 */
function startClock() {
  window.clearInterval(ticker);
  startedAt = Date.now();
  timeEl.textContent = "0:00";
  ticker = window.setInterval(updateClock, 500);
}

/**
 * Announces a win and freezes the clock.
 * @returns {void}
 */
function celebrate() {
  window.clearInterval(ticker);
  const moves = api.puzzle_moves();
  statusEl.textContent = `Solved in ${moves} moves and ${timeEl.textContent}.`;
  statusEl.classList.add("won");
}

/**
 * Starts a freshly shuffled game with a new picture.
 * @returns {void}
 */
function startGame() {
  const seed = Math.floor(Math.random() * 4294967295);
  api.puzzle_new(seed);
  const title = applyPhoto();
  statusEl.classList.remove("won");
  statusEl.textContent = title;
  render();
  startClock();
}

/**
 * Handles a tap on the board.
 * @param {PointerEvent} event The tap event.
 * @returns {void}
 */
function onBoardTap(event) {
  const index = indexFromPoint(event);
  if (index < 0 || api.puzzle_solved() === 1) {
    return;
  }
  if (api.puzzle_slide(index) !== 1) {
    return;
  }
  render();
  if (api.puzzle_solved() === 1) {
    celebrate();
  }
}

/**
 * Reports a start up failure in plain language.
 * @param {Error} error The failure that stopped the game.
 * @returns {void}
 */
function reportFailure(error) {
  statusEl.textContent =
    "Could not load the game engine. Open this page from a local web server, not from the file system.";
  statusEl.classList.add("won");
  console.error(error);
}

/**
 * Registers the offline cache worker.
 * @returns {Promise<void>} Resolves once registration was attempted.
 */
async function registerOffline() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (error) {
    console.warn("offline cache unavailable", error);
  }
}

/**
 * Wires up the page and begins the first game.
 * @returns {Promise<void>} Resolves once the game is ready.
 */
async function main() {
  createTiles();
  try {
    api = await loadWasm();
  } catch (error) {
    reportFailure(error);
    return;
  }
  photos = await loadPhotos();
  boardEl.addEventListener("pointerdown", onBoardTap);
  shuffleEl.addEventListener("click", startGame);
  startGame();
  await registerOffline();
}

main();

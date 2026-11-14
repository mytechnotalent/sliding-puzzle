/**
 * Sliding Puzzle
 * File: web/game.js
 * Author: Kevin Thomas
 * Date: 2026-11-14
 *
 * MIT License, see the LICENSE file for the full text.
 *
 * Loads the Rust compiled WebAssembly module and draws the board. The exact
 * puzzle position, move count, clock, and picture are saved to local storage
 * after every slide and restored when the page is reopened, so a puzzle can
 * be worked on for as long as desired. Only the Shuffle button starts fresh.
 */

const SIZE = 4;
const CELLS = SIZE * SIZE;
const BLANK = 0;
const OUT_OF_RANGE = 255;
const WASM_FILE = "puzzle.wasm";
const CREDITS_FILE = "photos/credits.json";
const SAVE_KEY = "sliding-puzzle-save";
const SAVE_VERSION = 1;

const boardEl = document.querySelector("#board");
const movesEl = document.querySelector("#moves");
const timeEl = document.querySelector("#time");
const statusEl = document.querySelector("#status");
const shuffleEl = document.querySelector("#shuffle");

let api = null;
let tiles = [];
let photos = [];
let currentPhoto = "";
let currentTitle = "";
let currentSeed = 0;
let slideHistory = "";
let gameSolved = false;
let finalElapsed = 0;
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
 * @param {string} [file] A saved photo file to reuse, empty for a random pick.
 * @returns {string} The title of the chosen photograph.
 */
function applyPhoto(file = "") {
  if (photos.length === 0) {
    boardEl.classList.add("numbers");
    currentPhoto = "";
    return "Numbered tiles";
  }
  let index = photos.findIndex((photo) => photo.file === file);
  if (index < 0) {
    index = Math.floor(Math.random() * photos.length);
    if (photos.length > 1 && photos[index].file === currentPhoto) {
      index = (index + 1) % photos.length;
    }
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
 * @param {number} elapsedSeconds Seconds already spent on the puzzle.
 * @returns {void}
 */
function startClock(elapsedSeconds = 0) {
  window.clearInterval(ticker);
  startedAt = Date.now() - elapsedSeconds * 1000;
  timeEl.textContent = formatTime(elapsedSeconds);
  ticker = window.setInterval(updateClock, 500);
}

/**
 * Announces a win and freezes the clock.
 * @returns {void}
 */
function celebrate() {
  window.clearInterval(ticker);
  gameSolved = true;
  finalElapsed = Math.floor((Date.now() - startedAt) / 1000);
  timeEl.textContent = formatTime(finalElapsed);
  const moves = api.puzzle_moves();
  statusEl.textContent = `Solved in ${moves} moves and ${timeEl.textContent}.`;
  statusEl.classList.add("won");
  saveGame();
}

/**
 * Reads the saved game from local storage.
 * @returns {object|null} The save record, or null when missing or invalid.
 */
function loadSave() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch (error) {
    console.warn("could not read saved progress", error);
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const save = JSON.parse(raw);
    const valid =
      save.version === SAVE_VERSION &&
      Number.isInteger(save.seed) &&
      save.seed >= 0 &&
      save.seed <= 4294967295 &&
      typeof save.slides === "string" &&
      /^[0-9a-f]*$/.test(save.slides) &&
      typeof save.photo === "string" &&
      typeof save.title === "string" &&
      Number.isInteger(save.elapsed) &&
      save.elapsed >= 0 &&
      typeof save.solved === "boolean";
    return valid ? save : null;
  } catch (error) {
    console.warn("saved progress is unreadable", error);
    return null;
  }
}

/**
 * Writes the current game to local storage.
 * @returns {void}
 */
function saveGame() {
  if (!api) {
    return;
  }
  const cells = [];
  for (let index = 0; index < CELLS; index += 1) {
    cells.push(api.puzzle_tile(index));
  }
  const elapsed = gameSolved
    ? finalElapsed
    : Math.floor((Date.now() - startedAt) / 1000);
  const save = {
    version: SAVE_VERSION,
    seed: currentSeed,
    slides: slideHistory,
    cells,
    moves: api.puzzle_moves(),
    photo: currentPhoto,
    title: currentTitle,
    elapsed,
    solved: gameSolved,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("could not save progress", error);
  }
}

/**
 * Restores a saved game so the player resumes the exact same position.
 * @param {object} save The save record produced by saveGame.
 * @returns {boolean} True when the saved position was restored.
 */
function restoreGame(save) {
  currentSeed = save.seed;
  slideHistory = "";
  api.puzzle_new(save.seed);
  for (const digit of save.slides) {
    const index = Number.parseInt(digit, 16);
    if (api.puzzle_slide(index) !== 1) {
      return false;
    }
    slideHistory += digit;
  }
  for (let index = 0; index < CELLS; index += 1) {
    if (api.puzzle_tile(index) !== save.cells[index]) {
      return false;
    }
  }
  gameSolved = save.solved;
  finalElapsed = save.elapsed;
  const restoredTitle = applyPhoto(save.photo);
  currentTitle = save.title || restoredTitle;
  render();
  statusEl.classList.remove("won");
  if (gameSolved) {
    timeEl.textContent = formatTime(finalElapsed);
    statusEl.textContent = `Solved in ${api.puzzle_moves()} moves and ${timeEl.textContent}.`;
    statusEl.classList.add("won");
  } else {
    statusEl.textContent = currentTitle;
    startClock(save.elapsed);
  }
  return true;
}

/**
 * Starts a freshly shuffled game with a new picture.
 * @returns {void}
 */
function startGame() {
  currentSeed = Math.floor(Math.random() * 4294967295);
  api.puzzle_new(currentSeed);
  slideHistory = "";
  gameSolved = false;
  finalElapsed = 0;
  currentTitle = applyPhoto();
  statusEl.classList.remove("won");
  statusEl.textContent = currentTitle;
  render();
  startClock();
  saveGame();
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
  slideHistory += index.toString(16);
  render();
  if (api.puzzle_solved() === 1) {
    celebrate();
  } else {
    saveGame();
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
 * Wires up the page and resumes the saved game, or begins the first one.
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
  window.addEventListener("pagehide", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveGame();
    }
  });
  const save = loadSave();
  if (!save || !restoreGame(save)) {
    startGame();
  }
  await registerOffline();
}

main();

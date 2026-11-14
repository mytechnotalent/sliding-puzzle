/**
 * Sliding Puzzle service worker.
 * File: web/sw.js
 * Author: Kevin Thomas
 * Date: 2026-11-14
 *
 * MIT License, see the LICENSE file for the full text.
 *
 * Caches the whole game on first load so it runs with no network.
 */

const CACHE_NAME = "sliding-puzzle-v3";

const SHELL_FILES = [
  "./",
  "index.html",
  "style.css",
  "game.js",
  "puzzle.wasm",
  "manifest.webmanifest",
  "icons/icon-32.png",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "photos/credits.json",
];

/**
 * Reads the list of bundled photographs.
 * @returns {Promise<Array<string>>} Photo paths to cache.
 */
async function photoPaths() {
  const response = await fetch("photos/credits.json", { cache: "reload" });
  const payload = await response.json();
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  return photos.map((photo) => `photos/${photo.file}`);
}

/**
 * Stores a list of files, ignoring any that fail.
 * @param {Cache} cache The cache receiving the files.
 * @param {Array<string>} urls Files to store.
 * @returns {Promise<void>} Resolves when every attempt finished.
 */
async function storeAll(cache, urls) {
  await Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)));
}

/**
 * Fills the cache with the shell and every photograph.
 * @returns {Promise<void>} Resolves once the cache is ready.
 */
async function prepare() {
  const cache = await caches.open(CACHE_NAME);
  await storeAll(cache, SHELL_FILES);
  const photos = await photoPaths().catch(() => []);
  await storeAll(cache, photos);
  await self.skipWaiting();
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepare());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanup());
});

/**
 * Removes caches left by earlier versions.
 * @returns {Promise<void>} Resolves once old caches are gone.
 */
async function cleanup() {
  const names = await caches.keys();
  const stale = names.filter((name) => name !== CACHE_NAME);
  await Promise.all(stale.map((name) => caches.delete(name)));
  await self.clients.claim();
}

/**
 * Answers a request from the cache, then from the network.
 * @param {Request} request The intercepted request.
 * @returns {Promise<Response>} The response to return.
 */
async function answer(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    return await fetch(request);
  } catch (error) {
    return caches.match("index.html");
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(answer(event.request));
});

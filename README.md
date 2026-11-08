# Sliding Puzzle

A four by four sliding puzzle with picture tiles. The game rules are written
in Rust, compiled to WebAssembly, and driven by a small amount of plain
JavaScript. It installs to an iPad home screen and then runs entirely
offline.

## Hosted app

https://mytechnotalent.github.io/sliding-puzzle/

## Layout

- `src/lib.rs` - crate root and module wiring
- `src/game.rs` - board state, moves, and win detection
- `src/board.rs` - board geometry and the solved layout
- `src/lcg.rs` - deterministic shuffle generator
- `src/abi.rs` - WebAssembly exports (the only unsafe attributes)
- `web/` - the playable page, the service worker, the icons, and photos
- `build.sh` - compiles the WASM and copies it into `web/`
- `.github/workflows/pages.yml` - publishes `web/` to GitHub Pages

## Build

Only needed after changing the Rust game logic.

```
./build.sh
```

## Deploy

Push to `main`. GitHub Actions publishes the `web/` folder with the Pages
workflow. The hosted URL updates automatically.

## Install on an iPad

1. Open https://mytechnotalent.github.io/sliding-puzzle/ in Safari.
2. Wait for the status line to finish loading once.
3. Use Share, Add to Home Screen.
4. Launch the game from the home screen. It works with WiFi off.

## Updating the game after a change

The service worker caches aggressively. Bump `CACHE_NAME` in `web/sw.js` after
changing any file, then reload the page twice on the iPad.

## Photographs

All pictures come from the Openverse API filtered to CC0 licences, so they may
be bundled and redistributed. Per-photo credits are in
`web/photos/credits.json`. The photos are already bundled in `web/photos`; no
download step is required to deploy.

## Tests

```
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

## Licensing

Code is MIT. Photographs are CC0 1.0. Credits for each picture, including the
creator and the source page, are recorded in `web/photos/credits.json`.

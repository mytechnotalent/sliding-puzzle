#!/usr/bin/env bash
# Sliding Puzzle
# File: build.sh
# Author: Sliding Puzzle Project Authors
# Date: 2026-11-08
#
# Compiles the Rust core to WebAssembly and copies it into the web folder.

set -euo pipefail
cd "$(dirname "$0")"

TARGET="wasm32-unknown-unknown"
OUT="target/${TARGET}/release/sliding_puzzle.wasm"

cargo build --release --target "${TARGET}"
cp "${OUT}" web/puzzle.wasm
echo "Built web/puzzle.wasm"

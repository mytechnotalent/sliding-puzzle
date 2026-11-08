//! Sliding Puzzle WebAssembly ABI
//!
//! File: src/abi.rs
//! Author: Kevin Thomas
//! Date: 2026-11-08
//!
//! MIT License
//!
//! Copyright (c) 2026 Kevin Thomas
//!
//! Permission is hereby granted, free of charge, to any person obtaining a copy
//! of this software and associated documentation files (the "Software"), to
//! deal in the Software without restriction, including without limitation the
//! rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//! sell copies of the Software, and to permit persons to whom the Software is
//! furnished to do so, subject to the following conditions:
//!
//! The above copyright notice and this permission notice shall be included in
//! all copies or substantial portions of the Software.
//!
//! THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//! IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//! FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//! AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//! LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//! FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//! DEALINGS IN THE SOFTWARE.
//!
//! The only unsafe surface is the `#[unsafe(no_mangle)]` attribute required to
//! export symbols under Rust 2024. There are no unsafe blocks, raw pointers,
//! or manual memory operations in this crate.

use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};

use crate::game::{DEFAULT_SEED, Game};

/// Value reported for a cell index outside the board.
const OUT_OF_RANGE: u32 = 255;

/// Game shared with the host page.
static GAME: OnceLock<Mutex<Game>> = OnceLock::new();

/// Returns the shared game, creating it on first use.
///
/// # Returns
///
/// A reference to the mutex that guards the game.
fn shared() -> &'static Mutex<Game> {
    GAME.get_or_init(|| Mutex::new(Game::shuffled(DEFAULT_SEED)))
}

/// Locks the shared game and recovers from a poisoned lock.
///
/// # Returns
///
/// A guard that grants mutable access to the game.
fn lock() -> MutexGuard<'static, Game> {
    shared().lock().unwrap_or_else(PoisonError::into_inner)
}

/// Starts a new shuffled game.
///
/// # Arguments
///
/// * `seed` - Seed for the shuffle.
///
/// # Returns
///
/// The move count of the new game, which is always zero.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn puzzle_new(seed: u32) -> u32 {
    let mut game = lock();
    *game = Game::shuffled(seed);
    game.moves()
}

/// Reads the tile stored at a cell index.
///
/// # Arguments
///
/// * `index` - Row-major cell index.
///
/// # Returns
///
/// The tile value, or 255 when the index is off the board.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn puzzle_tile(index: u32) -> u32 {
    let index = usize::try_from(index).unwrap_or(usize::MAX);
    lock().tile(index).map_or(OUT_OF_RANGE, u32::from)
}

/// Slides the tile at a cell index into the blank.
///
/// # Arguments
///
/// * `index` - Row-major index of the tapped tile.
///
/// # Returns
///
/// One when the tile moved, otherwise zero.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn puzzle_slide(index: u32) -> u32 {
    let index = usize::try_from(index).unwrap_or(usize::MAX);
    u32::from(lock().slide(index))
}

/// Reads the move counter of the shared game.
///
/// # Returns
///
/// The number of legal slides performed.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn puzzle_moves() -> u32 {
    lock().moves()
}

/// Reports whether the shared game is solved.
///
/// # Returns
///
/// One when solved, otherwise zero.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn puzzle_solved() -> u32 {
    let solved = lock().is_solved();
    u32::from(solved)
}

#[cfg(test)]
mod tests {
    use super::{puzzle_moves, puzzle_new, puzzle_slide, puzzle_solved, puzzle_tile};
    use crate::board::CELLS;

    /// The exported surface starts a game and reports its state.
    #[test]
    fn test_abi_starts_and_reports_game() {
        assert_eq!(puzzle_new(31), 0);
        assert_eq!(puzzle_moves(), 0);
        assert_eq!(puzzle_solved(), 0);
        assert!(puzzle_tile(0) < 16);
    }

    /// The exported surface rejects an index off the board.
    #[test]
    fn test_abi_rejects_out_of_range_index() {
        puzzle_new(5);
        let outside = u32::try_from(CELLS).unwrap_or_default();
        assert_eq!(puzzle_tile(outside), 255);
        assert_eq!(puzzle_slide(outside), 0);
    }
}

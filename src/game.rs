//! Sliding Puzzle Game Model
//!
//! File: src/game.rs
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

use crate::board::{BLANK, CELLS, SIDE, adjacent, solved_cells};
use crate::lcg::Lcg;

/// Number of random slides applied when shuffling.
const SHUFFLE_STEPS: usize = 200;

/// Attempts allowed when picking a legal random slide.
const SLIDE_ATTEMPTS: usize = 16;

/// Seed used when the game is created without an explicit seed.
pub(crate) const DEFAULT_SEED: u32 = 0x5EED_1234;

/// State of a four by four sliding puzzle.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Game {
    /// Tile values in row-major order, with [`BLANK`] for the empty cell.
    pub(crate) cells: [u8; CELLS],
    /// Count of legal slides performed since the shuffle.
    moves: u32,
}

impl Game {
    /// Creates a game in the solved position.
    ///
    /// # Returns
    ///
    /// A game whose tiles run from one to fifteen with the blank last.
    #[must_use]
    pub fn new() -> Self {
        Self { cells: solved_cells(), moves: 0 }
    }

    /// Creates a game shuffled by a deterministic pseudo random walk.
    ///
    /// # Arguments
    ///
    /// * `seed` - Seed for the pseudo random walk.
    ///
    /// # Returns
    ///
    /// A solvable game in a shuffled position with zero moves recorded.
    #[must_use]
    pub fn shuffled(seed: u32) -> Self {
        let mut game = Self::new();
        let mut rng = Lcg::new(seed);
        for _ in 0..SHUFFLE_STEPS {
            game.random_slide(&mut rng);
        }
        game.rescramble(&mut rng);
        game.moves = 0;
        game
    }

    /// Returns a copy of every cell on the board.
    ///
    /// # Returns
    ///
    /// Tile values in row-major order, with zero for the blank.
    #[must_use]
    pub fn cells(&self) -> [u8; CELLS] {
        self.cells
    }

    /// Returns the tile at a cell index.
    ///
    /// # Arguments
    ///
    /// * `index` - Row-major cell index.
    ///
    /// # Returns
    ///
    /// The tile value, or `None` when the index is off the board.
    #[must_use]
    pub fn tile(&self, index: usize) -> Option<u8> {
        self.cells.get(index).copied()
    }

    /// Returns the cell index holding the blank.
    ///
    /// # Returns
    ///
    /// The row-major index of the blank, or `None` when it is missing.
    #[must_use]
    pub fn blank(&self) -> Option<usize> {
        self.cells.iter().position(|cell| *cell == BLANK)
    }

    /// Returns the number of legal slides performed.
    ///
    /// # Returns
    ///
    /// The move counter of the current game.
    #[must_use]
    pub fn moves(&self) -> u32 {
        self.moves
    }

    /// Reports whether the tiles are in the solved order.
    ///
    /// # Returns
    ///
    /// `true` when every tile sits in its solved position.
    #[must_use]
    pub fn is_solved(&self) -> bool {
        self.cells == solved_cells()
    }

    /// Reports whether the position can reach the solved state.
    ///
    /// # Returns
    ///
    /// `true` when the inversion parity allows a solution.
    #[must_use]
    pub fn is_solvable(&self) -> bool {
        let Some(blank) = self.blank() else {
            return false;
        };
        let row = SIDE - (blank / SIDE);
        let row = u32::try_from(row).unwrap_or(0);
        (self.inversions() + row) % 2 == 1
    }

    /// Slides the tile at an index into the blank cell.
    ///
    /// # Arguments
    ///
    /// * `index` - Row-major index of the tile to slide.
    ///
    /// # Returns
    ///
    /// `true` when the tile was adjacent to the blank and moved.
    pub fn slide(&mut self, index: usize) -> bool {
        let Some(blank) = self.blank() else {
            return false;
        };
        if !adjacent(index, blank) {
            return false;
        }
        self.cells.swap(index, blank);
        self.moves += 1;
        true
    }

    /// Slides a random neighbouring tile, ignoring impossible picks.
    ///
    /// # Arguments
    ///
    /// * `rng` - Generator that supplies the cell indices.
    fn random_slide(&mut self, rng: &mut Lcg) {
        let bound = u32::try_from(CELLS).unwrap_or(1);
        for _ in 0..SLIDE_ATTEMPTS {
            let index = usize::try_from(rng.below(bound)).unwrap_or(0);
            if self.slide(index) {
                return;
            }
        }
    }

    /// Keeps shuffling while the board is still solved.
    ///
    /// # Arguments
    ///
    /// * `rng` - Generator that supplies the cell indices.
    fn rescramble(&mut self, rng: &mut Lcg) {
        for _ in 0..SLIDE_ATTEMPTS {
            if !self.is_solved() {
                return;
            }
            self.random_slide(rng);
        }
    }

    /// Counts inversions among the numbered tiles.
    ///
    /// # Returns
    ///
    /// The number of pairs that appear out of ascending order.
    fn inversions(&self) -> u32 {
        let mut count = 0;
        for (start, tile) in self.cells.iter().enumerate() {
            for other in self.cells.iter().skip(start + 1) {
                count += u32::from(*tile != BLANK && *other != BLANK && tile > other);
            }
        }
        count
    }
}

impl Default for Game {
    /// Creates a solved game.
    ///
    /// # Returns
    ///
    /// A game in the solved position.
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::Game;
    use crate::board::{BLANK, CELLS};

    /// A new game starts solved with no recorded moves.
    #[test]
    fn test_new_game_is_solved() {
        let game = Game::new();
        assert!(game.is_solved());
        assert_eq!(game.moves(), 0);
        assert_eq!(game.blank(), Some(CELLS - 1));
    }

    /// The solved board holds tiles one to fifteen in order.
    #[test]
    fn test_solved_board_order() {
        let game = Game::new();
        let expected: [u8; CELLS] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
        assert_eq!(game.cells(), expected);
    }

    /// A slide next to the blank moves the tile and counts the move.
    #[test]
    fn test_slide_moves_adjacent_tile() {
        let mut game = Game::new();
        assert!(game.slide(14));
        assert_eq!(game.tile(14), Some(BLANK));
        assert_eq!(game.tile(15), Some(15));
        assert_eq!(game.moves(), 1);
    }

    /// Sliding a tile twice in a row restores the solved board.
    #[test]
    fn test_double_slide_restores_board() {
        let mut game = Game::new();
        assert!(game.slide(14));
        assert!(game.slide(15));
        assert!(game.is_solved());
        assert_eq!(game.moves(), 2);
    }

    /// A tile far from the blank is refused and is not counted.
    #[test]
    fn test_slide_rejects_distant_tile() {
        let mut game = Game::new();
        assert!(!game.slide(0));
        assert_eq!(game.moves(), 0);
        assert!(game.is_solved());
    }

    /// An index off the board is refused by both slide and tile.
    #[test]
    fn test_rejects_out_of_range_index() {
        let mut game = Game::new();
        assert!(!game.slide(CELLS));
        assert_eq!(game.tile(CELLS), None);
        assert_eq!(game.moves(), 0);
    }

    /// Shuffling with a seed always yields a solvable position.
    #[test]
    fn test_shuffled_game_is_solvable() {
        for seed in [0, 1, 7, 42, 12_345] {
            let game = Game::shuffled(seed);
            assert!(game.is_solvable(), "seed {seed} was not solvable");
        }
    }

    /// The same seed produces the same board twice.
    #[test]
    fn test_shuffle_is_deterministic() {
        let first = Game::shuffled(2_024);
        let second = Game::shuffled(2_024);
        assert_eq!(first, second);
    }

    /// Shuffling leaves the solved board behind for a used seed.
    #[test]
    fn test_shuffled_game_is_not_solved() {
        let game = Game::shuffled(9);
        assert!(!game.is_solved());
        assert_eq!(game.moves(), 0);
    }

    /// A board with a single swap is unsolvable.
    #[test]
    fn test_swapped_pair_is_unsolvable() {
        let mut game = Game::new();
        game.cells.swap(0, 1);
        assert!(!game.is_solvable());
    }
}

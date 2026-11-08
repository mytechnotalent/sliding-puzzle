//! Sliding Puzzle Board Geometry
//!
//! File: src/board.rs
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

/// Edge length of the square board.
pub(crate) const SIDE: usize = 4;

/// Total number of cells on the board.
pub(crate) const CELLS: usize = SIDE * SIDE;

/// Value stored in the empty cell.
pub(crate) const BLANK: u8 = 0;

/// Builds the solved arrangement of cells.
///
/// # Returns
///
/// Tile values one to fifteen with the blank in the last cell.
pub(crate) fn solved_cells() -> [u8; CELLS] {
    let mut cells = [BLANK; CELLS];
    for (index, cell) in cells.iter_mut().enumerate() {
        *cell = u8::try_from(index + 1).unwrap_or(BLANK);
    }
    cells[CELLS - 1] = BLANK;
    cells
}

/// Reports whether two cell indices share an edge.
///
/// # Arguments
///
/// * `first` - Row-major index of the first cell.
/// * `second` - Row-major index of the second cell.
///
/// # Returns
///
/// `true` when the cells touch horizontally or vertically.
pub(crate) fn adjacent(first: usize, second: usize) -> bool {
    let (first_x, first_y) = (first % SIDE, first / SIDE);
    let (second_x, second_y) = (second % SIDE, second / SIDE);
    first_x.abs_diff(second_x) + first_y.abs_diff(second_y) == 1
}

#[cfg(test)]
mod tests {
    use super::{BLANK, CELLS, adjacent, solved_cells};

    /// The solved board holds tiles one to fifteen in order.
    #[test]
    fn test_solved_cells_are_ordered() {
        let expected: [u8; CELLS] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
        assert_eq!(solved_cells(), expected);
    }

    /// Adjacency accepts neighbours and rejects diagonal cells.
    #[test]
    fn test_adjacency_rules() {
        assert!(adjacent(0, 1));
        assert!(adjacent(5, 9));
        assert!(!adjacent(0, 5));
        assert!(!adjacent(3, 4));
        assert!(!adjacent(7, 7));
    }

    /// The solved board ends with the blank in the last cell.
    #[test]
    fn test_solved_cells_end_with_blank() {
        assert_eq!(solved_cells()[CELLS - 1], BLANK);
    }
}

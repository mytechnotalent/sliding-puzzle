//! Sliding Puzzle Random Generator
//!
//! File: src/lcg.rs
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

/// Multiplier of the internal pseudo random generator.
const LCG_MULTIPLIER: u32 = 1_664_525;

/// Increment of the internal pseudo random generator.
const LCG_INCREMENT: u32 = 1_013_904_223;

/// Shift that selects the well mixed high bits of the generator state.
const LCG_SHIFT: u32 = 16;

/// Seed mixing constant for the internal pseudo random generator.
const LCG_MIX: u32 = 0x9E37_79B9;

/// Minimal linear congruential generator used for shuffling.
#[derive(Debug, Clone)]
pub(crate) struct Lcg {
    /// Current state of the generator.
    state: u32,
}

impl Lcg {
    /// Creates a generator from a seed.
    ///
    /// # Arguments
    ///
    /// * `seed` - Starting value mixed into the state.
    ///
    /// # Returns
    ///
    /// A generator ready to produce values.
    pub(crate) fn new(seed: u32) -> Self {
        Self { state: seed ^ LCG_MIX }
    }

    /// Produces the next value below a bound.
    ///
    /// # Arguments
    ///
    /// * `bound` - Exclusive upper limit, treated as one when zero.
    ///
    /// # Returns
    ///
    /// A value in the range zero to `bound` minus one.
    pub(crate) fn below(&mut self, bound: u32) -> u32 {
        let next = self.state.wrapping_mul(LCG_MULTIPLIER);
        self.state = next.wrapping_add(LCG_INCREMENT);
        let high = self.state >> LCG_SHIFT;
        high % bound.max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::Lcg;

    /// The same seed produces the same sequence twice.
    #[test]
    fn test_below_is_deterministic() {
        let mut first = Lcg::new(42);
        let mut second = Lcg::new(42);
        assert_eq!(first.below(16), second.below(16));
        assert_eq!(first.below(16), second.below(16));
    }

    /// A generated value stays below the requested bound.
    #[test]
    fn test_below_respects_bound() {
        let mut rng = Lcg::new(7);
        for _ in 0..100 {
            assert!(rng.below(16) < 16);
        }
    }

    /// A zero bound is treated as one and returns zero.
    #[test]
    fn test_below_zero_bound_returns_zero() {
        assert_eq!(Lcg::new(1).below(0), 0);
    }
}

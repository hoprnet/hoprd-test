//! Concrete scenarios. One file per scenario; register them in
//! [`crate::scenario::registry`].

mod one_hop;
mod zero_hop;

pub use one_hop::OneHopThroughput;
pub use zero_hop::ZeroHopThroughput;

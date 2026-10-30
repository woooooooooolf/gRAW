mod generator;
pub(crate) mod model;
mod packing;
mod patterns;

pub use generator::{GenerationError, GenerationResult, generate_to_path};
pub use model::{FrameLayout, RawConfig};

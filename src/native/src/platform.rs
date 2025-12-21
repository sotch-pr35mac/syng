//! Platform-specific functionality.

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "macos")]
pub use macos::{ToolbarThickness, WindowExt, WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y};


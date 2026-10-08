//! Platform-specific functionality.

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "macos")]
pub use macos::{ToolbarThickness, WindowExt, WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y};

#[cfg(target_os = "ios")]
pub mod ios;

// Compile the storage policy on other hosts for its filesystem regression tests.
#[cfg(any(target_os = "linux", test))]
pub mod linux;

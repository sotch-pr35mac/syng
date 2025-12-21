//! Window management for the application.
//!
//! This module contains setup and configuration for all application windows.

pub mod character;
mod main;

use tauri::Manager;

pub use character::open_character_window;

/// Sets up all application windows.
///
/// This should be called during app setup to configure window behavior,
/// event handlers, and platform-specific customizations.
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Set up the main window
    main::setup(app);

    // Set up the character window (desktop only)
    #[cfg(desktop)]
    {
        let character_window = app.get_webview_window("characters").unwrap();
        character::setup(&character_window);
    }

    Ok(())
}


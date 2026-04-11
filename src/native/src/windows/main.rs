//! Main window management.
//!
//! This module handles the main application window setup and event handling.

use tauri::Manager;

#[cfg(target_os = "macos")]
use crate::platform::{WindowExt, WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y};

/// Sets up the main window with appropriate event handlers.
///
/// This configures:
/// - macOS traffic light positioning
/// - Window resize behavior (redraws traffic lights on macOS)
/// - DevTools in debug mode
pub fn setup(app: &tauri::App) {
    let main_window = app.get_webview_window("syng").unwrap();

    #[cfg(target_os = "macos")]
    {
        main_window.set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);

        // Redraw traffic lights on resize
        let main_window_clone = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::Resized { .. } = event {
                main_window_clone.set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);
            }
        });
    }

    #[cfg(debug_assertions)]
    main_window.open_devtools();
}


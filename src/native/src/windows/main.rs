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

        let main_window_clone = main_window.clone();
        let app_handle = app.handle().clone();
        main_window.on_window_event(move |event| {
            match event {
                // Redraw traffic lights on resize.
                tauri::WindowEvent::Resized { .. } => {
                    main_window_clone
                        .set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);
                }
                // On macOS, prevent the window from being destroyed so it stays in
                // Tauri's window registry and can be re-shown via the dock icon.
                // JS-level event.preventDefault() only skips the JS destroy() call;
                // it does not stop Tauri from removing the window from its registry.
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = main_window_clone.hide();
                    if let Some(chars) = app_handle.get_webview_window("characters") {
                        let _ = chars.hide();
                    }
                }
                _ => {}
            }
        });
    }

    // On Windows and Linux, closing the main window should end the process. The character
    // window uses hide-on-close (not destroy), so without this the app can survive with
    // no visible windows after the user dismisses the main UI.
    #[cfg(all(desktop, not(target_os = "macos")))]
    {
        let app_handle = app.handle().clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                app_handle.exit(0);
            }
        });
    }

    #[cfg(debug_assertions)]
    main_window.open_devtools();
}


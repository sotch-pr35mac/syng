//! Main window management.
//!
//! This module handles the main application window setup and event handling.

use std::sync::{Arc, Mutex};
use tauri::{Manager, WebviewWindow, WindowEvent};

#[cfg(target_os = "macos")]
use crate::platform::{WindowExt, WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y};

/// Sets up the main window with appropriate event handlers.
///
/// This configures:
/// - macOS traffic light positioning
/// - Window close behavior (exits the app)
/// - Window resize behavior (redraws traffic lights on macOS)
/// - DevTools in debug mode
pub fn setup(app: &tauri::App) {
    let main_window = app.get_webview_window("main").unwrap();
    let main_window = Arc::new(Mutex::new(main_window));

    #[cfg(target_os = "macos")]
    {
        main_window
            .lock()
            .unwrap()
            .set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);
    }

    #[cfg(debug_assertions)]
    main_window.lock().unwrap().open_devtools();

    setup_window_events(app, main_window);
}

/// Configures event handlers for the main window.
fn setup_window_events(app: &tauri::App, main_window: Arc<Mutex<WebviewWindow>>) {
    let handle = app.handle().clone();

    #[cfg(target_os = "macos")]
    let main_window_clone = main_window.clone();

    main_window.lock().unwrap().on_window_event(move |event| {
        match event {
            WindowEvent::CloseRequested { .. } => {
                // TODO(macos): When the app icon is clicked from the dock, open the main
                // window. Currently, Tauri doesn't offer a way to capture dock click
                // events, so for now we'll just close the application when the main
                // window is closed, like we do for other platforms.
                handle.exit(0);
            }
            WindowEvent::Resized { .. } => {
                // On macOS we want to redraw the traffic lights when the window is resized.
                #[cfg(target_os = "macos")]
                {
                    main_window_clone.lock().unwrap().set_window_controls_pos(
                        WINDOW_CONTROL_PAD_X,
                        WINDOW_CONTROL_PAD_Y,
                    );
                }
            }
            _ => (),
        }
    });
}


//! Character window management.
//!
//! This module handles the character detail window, which displays
//! stroke order and character information.

#[cfg(desktop)]
use serde::{Deserialize, Serialize};
#[cfg(desktop)]
use tauri::{Emitter, Manager, WebviewWindow, WindowEvent};

/// Data structure for displaying character information.
#[cfg(desktop)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CharacterWindowWord {
    pub traditional: String,
    pub simplified: String,
}

/// Opens the character window and displays the given word.
#[cfg(desktop)]
#[tauri::command]
pub fn open_character_window(app_handle: tauri::AppHandle, word: CharacterWindowWord) {
    let character_window = app_handle.get_webview_window("characters").unwrap();
    character_window.emit("display-characters", word).unwrap();
    character_window.show().unwrap();
}

/// Sets up the character window with appropriate event handlers.
#[cfg(desktop)]
pub fn setup(character_window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        use crate::platform::{ToolbarThickness, WindowExt};
        character_window.set_transparent_titlebar(ToolbarThickness::Medium);
    }

    #[cfg(debug_assertions)]
    character_window.open_devtools();

    let window = character_window.clone();
    character_window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    });
}

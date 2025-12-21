//! Application menu configuration.
//!
//! This module handles the creation and event handling for the application menu.

use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::Runtime;
use tauri_plugin_opener::OpenerExt;

/// Creates the application menu with Help submenu.
pub fn create<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<tauri::menu::Menu<R>, tauri::Error> {
    let help_submenu = SubmenuBuilder::new(app, "Help")
        .text("github", "Github")
        .separator()
        .text("license", "License")
        .text("cc-cedict", "CC-CEDICT License")
        .separator()
        .text("bug", "Report Bug")
        .build()?;

    MenuBuilder::new(app).items(&[&help_submenu]).build()
}

/// Handles menu item click events.
pub fn handle_event<R: Runtime>(app: &tauri::AppHandle<R>, event: &tauri::menu::MenuEvent) {
    let url = match event.id().as_ref() {
        "github" => Some("https://github.com/sotch-pr35mac/syng"),
        "license" => Some("https://github.com/sotch-pr35mac/syng/blob/master/LICENSE"),
        "cc-cedict" => Some("https://github.com/sotch-pr35mac/syng/blob/master/LICENSE-CC-CEDICT"),
        "bug" => Some("https://github.com/sotch-pr35mac/syng/issues"),
        _ => None,
    };

    if let Some(url) = url {
        app.opener().open_url(url, None::<&str>).unwrap();
    }
}


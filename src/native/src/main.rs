#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod dictionary;

use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
use serde::{Deserialize, Serialize};
use tauri::{
    api::shell::open as open_browser, CustomMenuItem, Manager, Menu, MenuItem, Runtime, Submenu,
    Window, WindowEvent,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct CharacterWindowWord {
    traditional: String,
    simplified: String,
}

#[tauri::command]
fn open_character_window(app_handle: tauri::AppHandle, word: CharacterWindowWord) {
    let character_window = app_handle.get_window("characters").unwrap();
    character_window.emit("display-characters", word).unwrap();
    character_window.show().unwrap();
}

pub enum ToolbarThickness {
    Thick,
    Medium,
    Thin,
}

pub trait WindowExt {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness);
}

impl<R: Runtime> WindowExt for Window<R> {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness) {
        use cocoa::appkit::{NSWindow, NSWindowTitleVisibility};

        unsafe {
            let id = self.ns_window().unwrap() as cocoa::base::id;

            id.setTitlebarAppearsTransparent_(cocoa::base::YES);

            match thickness {
                ToolbarThickness::Thick => {
                    self.set_title("").expect("Title wasn't set to ''");
                    make_toolbar(id);
                }
                ToolbarThickness::Medium => {
                    id.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
                    make_toolbar(id);
                }
                ToolbarThickness::Thin => {
                    id.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
unsafe fn make_toolbar(id: cocoa::base::id) {
    use cocoa::appkit::{NSToolbar, NSWindow};

    let new_toolbar = NSToolbar::alloc(id);
    new_toolbar.init_();
    id.setToolbar_(new_toolbar);
}

fn create_menu(app_name: &str) -> Menu {
    Menu::os_default(app_name).add_submenu(Submenu::new(
        "Help",
        Menu::new()
            .add_item(CustomMenuItem::new("github", "Github"))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("license", "License"))
            .add_item(CustomMenuItem::new("cc-cedict", "CC-CEDICT License"))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("bug", "Report Bug")),
    ))
}

fn main() {
    let app_context = tauri::generate_context!();
    let app_menu = create_menu(&app_context.package_info().name);
    tauri::Builder::default()
        .setup(|app| {
            let main_window = app.get_window("main").unwrap();
            main_window.set_transparent_titlebar(ToolbarThickness::Thick);
            main_window.open_devtools();

            let character_window = app.get_window("characters").unwrap();
            character_window.set_transparent_titlebar(ToolbarThickness::Medium);
            character_window.open_devtools();

            let handle = app.handle();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    /* TODO(macos): When the app icon is clicked from the dock, open the main window.
                     * Currently, Tuair doesn't offer a way to capture dock click events, so
                     * for now we'll just clcose the application when the main window is
                     * closed, like we do for other platforms.
                     */

                    // When the main window is closed, emit an exit event.
                    handle.exit(0);
                }
            });

            let character_window_toggler = character_window.clone();
            character_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    character_window_toggler.hide().unwrap();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler!(
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese,
            open_character_window
        ))
        .menu(app_menu)
        .on_menu_event(|event| match event.menu_item_id() {
            "github" => {
                open_browser(
                    &event.window().shell_scope(),
                    "https://github.com/sotch-pr35mac/syng",
                    None,
                )
                .unwrap();
            }
            "license" => {
                open_browser(
                    &event.window().shell_scope(),
                    "https://github.com/sotch-pr35mac/syng/blob/master/LICENSE",
                    None,
                )
                .unwrap();
            }
            "cc-cedict" => {
                open_browser(
                    &event.window().shell_scope(),
                    "https://github.com/sotch-pr35mac/syng/blob/master/LICENSE-CC-CEDICT",
                    None,
                )
                .unwrap();
            }
            "bug" => {
                open_browser(
                    &event.window().shell_scope(),
                    "https://github.com/sotch-pr35mac/syng/issues",
                    None,
                )
                .unwrap();
            }
            _ => (),
        })
        .run(app_context)
        .expect("error while running tauri application");
}

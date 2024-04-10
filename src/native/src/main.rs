#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod dictionary;
mod io;

use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
use io::{export_list_data, import_list_data};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
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

// Code to set the macOS traffic lights inset.
// Implementation taken from:
// https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-selfhost-desktop/src-tauri/src/mac/window.rs
const WINDOW_CONTROL_PAD_X: f64 = 20.0;
const WINDOW_CONTROL_PAD_Y: f64 = 23.0;

pub enum ToolbarThickness {
    Thick,
    Medium,
    Thin,
}

pub trait WindowExt {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness);

    #[cfg(target_os = "macos")]
    fn set_window_controls_pos(&self, x: f64, y: f64);
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

    #[cfg(target_os = "macos")]
    fn set_window_controls_pos(&self, x: f64, y: f64) {
        use cocoa::{
            appkit::{NSView, NSWindow, NSWindowButton},
            foundation::NSRect,
        };
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let window = self.ns_window().unwrap() as cocoa::base::id;

            let close = window.standardWindowButton_(NSWindowButton::NSWindowCloseButton);
            let minimize = window.standardWindowButton_(NSWindowButton::NSWindowMiniaturizeButton);
            let maximize = window.standardWindowButton_(NSWindowButton::NSWindowZoomButton);

            let title_bar_container_view = close.superview().superview();

            let close_rect: NSRect = msg_send![close, frame];
            let button_height = close_rect.size.height;

            let title_bar_frame_height = button_height + y;
            let mut title_bar_rect = NSView::frame(title_bar_container_view);
            title_bar_rect.size.height = title_bar_frame_height;
            title_bar_rect.origin.y = NSView::frame(window).size.height - title_bar_frame_height;
            let _: () = msg_send![title_bar_container_view, setFrame: title_bar_rect];

            let window_buttons = vec![close, minimize, maximize];
            let space_between = NSView::frame(minimize).origin.x - NSView::frame(close).origin.x;

            for (i, button) in window_buttons.into_iter().enumerate() {
                let mut rect: NSRect = NSView::frame(button);
                rect.origin.x = x + (i as f64 * space_between);
                button.setFrameOrigin(rect.origin);
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
            let main_window = Arc::new(Mutex::new(main_window));
            let character_window = app.get_window("characters").unwrap();

            #[cfg(target_os = "macos")]
            {
                // main_window.set_transparent_titlebar(ToolbarThickness::Thick);
                // character_window.set_transparent_titlebar(ToolbarThickness::Medium);
                main_window
                    .lock()
                    .unwrap()
                    .set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);
            }

            #[cfg(debug_assertions)]
            {
                main_window.lock().unwrap().open_devtools();
                character_window.open_devtools();
            }

            let handle = app.handle();
            let main_window_clone = main_window.clone();
            main_window.lock().unwrap().on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { .. } => {
                        /* TODO(macos): When the app icon is clicked from the dock, open the main window.
                         * Currently, Tuair doesn't offer a way to capture dock click events, so
                         * for now we'll just clcose the application when the main window is
                         * closed, like we do for other platforms.
                         */

                        // When the main window is closed, emit an exit event.
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
            open_character_window,
            export_list_data,
            import_list_data,
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

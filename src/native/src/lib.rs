#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod dictionary;
mod io;
mod quiz;
mod utils;

use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
use io::{export_list_data, import_list_data};
use quiz::{
    answer_question, get_incorrect_questions, get_next_question, score_quiz, start_quiz, QuizState,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, Runtime, WebviewWindow, Window, WindowEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct CharacterWindowWord {
    traditional: String,
    simplified: String,
}

#[tauri::command]
fn open_character_window(app_handle: tauri::AppHandle, word: CharacterWindowWord) {
    let character_window = app_handle.get_webview_window("characters").unwrap();
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

impl<R: Runtime> WindowExt for WebviewWindow<R> {
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

fn create_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<tauri::menu::Menu<R>, tauri::Error> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_context = tauri::generate_context!();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_cli::init())
        .setup(|app| {
            let app_menu = create_menu(app.handle())?;
            app.set_menu(app_menu)?;
            let main_window = app.get_webview_window("main").unwrap();
            let main_window = Arc::new(Mutex::new(main_window));
            let character_window = app.get_webview_window("characters").unwrap();

            #[cfg(target_os = "macos")]
            {
                character_window.set_transparent_titlebar(ToolbarThickness::Medium);
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

            let handle = app.handle().clone();
            let main_window_clone = main_window.clone();
            main_window.lock().unwrap().on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { .. } => {
                        /* TODO(macos): When the app icon is clicked from the dock, open the main
                         * window. Currently, Tauri doesn't offer a way to capture dock click
                         * events, so for now we'll just clcose the application when the main
                         * window is closed, like we do for other platforms.
                         */

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
        .manage(QuizState::default())
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
            start_quiz,
            get_next_question,
            answer_question,
            score_quiz,
            get_incorrect_questions
        ))
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "github" => {
                        #[allow(deprecated)]
                        window
                            .shell()
                            .open("https://github.com/sotch-pr35mac/syng", None)
                            .unwrap();
                    }
                    "license" => {
                        #[allow(deprecated)]
                        window
                            .shell()
                            .open(
                                "https://github.com/sotch-pr35mac/syng/blob/master/LICENSE",
                                None,
                            )
                            .unwrap();
                    }
                    "cc-cedict" => {
                        #[allow(deprecated)]
                        window
                            .shell()
                            .open(
                                "https://github.com/sotch-pr35mac/syng/blob/master/LICENSE-CC-CEDICT",
                                None,
                            )
                            .unwrap();
                    }
                    "bug" => {
                        #[allow(deprecated)]
                        window
                            .shell()
                            .open("https://github.com/sotch-pr35mac/syng/issues", None)
                            .unwrap();
                    }
                    _ => (),
                }
            }
        })
        .run(app_context)
        .expect("error while running tauri application");
}

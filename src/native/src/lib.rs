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
#[cfg(desktop)]
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, Runtime, WebviewWindow, Window, WindowEvent};
#[cfg(desktop)]
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct CharacterWindowWord {
    traditional: String,
    simplified: String,
}

#[tauri::command]
fn open_character_window(app_handle: tauri::AppHandle, word: CharacterWindowWord) {
    let character_window = app_handle.get_webview_window("characters").unwrap();
    character_window.emit("display-characters", word).unwrap();
    #[cfg(desktop)]
    character_window.show().unwrap();
}

// Code to set the macOS traffic lights inset.
// Implementation taken from:
// https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-selfhost-desktop/src-tauri/src/mac/window.rs
const WINDOW_CONTROL_PAD_X: f64 = 17.0;
const WINDOW_CONTROL_PAD_Y: f64 = 28.0;

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
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use objc2_app_kit::{NSWindow, NSWindowTitleVisibility};

        unsafe {
            let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
            let ns_window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

            ns_window.setTitlebarAppearsTransparent(true);

            match thickness {
                ToolbarThickness::Thick => {
                    self.set_title("").expect("Title wasn't set to ''");
                    make_toolbar(ns_window.as_ref());
                }
                ToolbarThickness::Medium => {
                    ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                    make_toolbar(ns_window.as_ref());
                }
                ToolbarThickness::Thin => {
                    ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    fn set_window_controls_pos(&self, x: f64, y: f64) {
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use objc2_app_kit::{NSWindow, NSWindowButton};

        unsafe {
            let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
            let window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

            let close = window
                .standardWindowButton(NSWindowButton::CloseButton)
                .unwrap();
            let minimize = window
                .standardWindowButton(NSWindowButton::MiniaturizeButton)
                .unwrap();
            let maximize = window
                .standardWindowButton(NSWindowButton::ZoomButton)
                .unwrap();

            let title_bar_container_view = close.superview().unwrap().superview().unwrap();

            let close_rect = close.frame();
            let button_height = close_rect.size.height;

            let title_bar_frame_height = button_height + y;
            let mut title_bar_rect = title_bar_container_view.frame();
            title_bar_rect.size.height = title_bar_frame_height;
            title_bar_rect.origin.y = window.frame().size.height - title_bar_frame_height;
            title_bar_container_view.setFrame(title_bar_rect);

            let space_between = minimize.frame().origin.x - close.frame().origin.x;
            let window_buttons = vec![close, minimize, maximize];

            for (i, button) in window_buttons.into_iter().enumerate() {
                let mut rect = button.frame();
                rect.origin.x = x + (i as f64 * space_between);
                button.setFrameOrigin(rect.origin);
            }
        }
    }
}

impl<R: Runtime> WindowExt for WebviewWindow<R> {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness) {
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use objc2_app_kit::{NSWindow, NSWindowTitleVisibility};

        unsafe {
            let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
            let ns_window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

            ns_window.setTitlebarAppearsTransparent(true);

            match thickness {
                ToolbarThickness::Thick => {
                    self.set_title("").expect("Title wasn't set to ''");
                    make_toolbar(ns_window.as_ref());
                }
                ToolbarThickness::Medium => {
                    ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                    make_toolbar(ns_window.as_ref());
                }
                ToolbarThickness::Thin => {
                    ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    fn set_window_controls_pos(&self, x: f64, y: f64) {
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use objc2_app_kit::{NSWindow, NSWindowButton};

        unsafe {
            let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
            let window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

            let close = window
                .standardWindowButton(NSWindowButton::CloseButton)
                .unwrap();
            let minimize = window
                .standardWindowButton(NSWindowButton::MiniaturizeButton)
                .unwrap();
            let maximize = window
                .standardWindowButton(NSWindowButton::ZoomButton)
                .unwrap();

            let title_bar_container_view = close.superview().unwrap().superview().unwrap();

            let close_rect = close.frame();
            let button_height = close_rect.size.height;

            let title_bar_frame_height = button_height + y;
            let mut title_bar_rect = title_bar_container_view.frame();
            title_bar_rect.size.height = title_bar_frame_height;
            title_bar_rect.origin.y = window.frame().size.height - title_bar_frame_height;
            title_bar_container_view.setFrame(title_bar_rect);

            let space_between = minimize.frame().origin.x - close.frame().origin.x;
            let window_buttons = vec![close, minimize, maximize];

            for (i, button) in window_buttons.into_iter().enumerate() {
                let mut rect = button.frame();
                rect.origin.x = x + (i as f64 * space_between);
                button.setFrameOrigin(rect.origin);
            }
        }
    }
}

#[cfg(target_os = "macos")]
unsafe fn make_toolbar(window: &objc2_app_kit::NSWindow) {
    use objc2::{MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::NSToolbar;
    use objc2_foundation::NSString;

    let mtm = MainThreadMarker::new().expect("must be on main thread");
    let toolbar =
        NSToolbar::initWithIdentifier(NSToolbar::alloc(mtm), &NSString::from_str("window_toolbar"));
    window.setToolbar(Some(&toolbar));
}

#[cfg(desktop)]
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
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            let main_window = Arc::new(Mutex::new(main_window));

            #[cfg(desktop)]
            {
                let app_menu = create_menu(app.handle())?;
                app.set_menu(app_menu)?;

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
                character_window.open_devtools();

                let character_window_toggler = character_window.clone();
                character_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        character_window_toggler.hide().unwrap();
                    }
                });
            }

            #[cfg(all(not(desktop), target_os = "macos"))]
            {
                main_window
                    .lock()
                    .unwrap()
                    .set_window_controls_pos(WINDOW_CONTROL_PAD_X, WINDOW_CONTROL_PAD_Y);
            }

            #[cfg(debug_assertions)]
            main_window.lock().unwrap().open_devtools();

            let handle = app.handle().clone();
            #[cfg(target_os = "macos")]
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
        ));

    #[cfg(desktop)]
    {
        builder = builder.on_menu_event(|app, event| {
            let url = match event.id().as_ref() {
                "github" => Some("https://github.com/sotch-pr35mac/syng"),
                "license" => Some("https://github.com/sotch-pr35mac/syng/blob/master/LICENSE"),
                "cc-cedict" => {
                    Some("https://github.com/sotch-pr35mac/syng/blob/master/LICENSE-CC-CEDICT")
                }
                "bug" => Some("https://github.com/sotch-pr35mac/syng/issues"),
                _ => None,
            };

            if let Some(url) = url {
                app.opener().open_url(url, None::<&str>).unwrap();
            }
        });
    }

    builder
        .run(app_context)
        .expect("error while running tauri application");
}

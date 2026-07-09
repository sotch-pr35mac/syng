#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod core;
#[cfg(desktop)]
mod menu;
mod platform;
mod utils;
mod windows;

use core::{
    answer_question, classify, convert_characters, export_list_data, get_acknowledgements,
    get_incorrect_questions, get_next_question, import_list_data, import_reader_document,
    init_dictionary, is_dev_build, is_mas_build, pinyinify, prepare_reader_import, prettify_pinyin,
    query, query_by_chinese, query_by_english, query_by_pinyin, read_legacy_migration_file,
    score_quiz, start_quiz, telemetry_get_prefs, telemetry_get_queued_events, telemetry_init,
    telemetry_set_pref, telemetry_track_error, telemetry_track_event, telemetry_track_screen,
    tokenize_pinyin, tokenize_reader_text, QuizState, TelemetryManager,
};
#[cfg(any(desktop, target_os = "ios"))]
use tauri::Manager;
#[cfg(desktop)]
use windows::open_character_window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // The self-updater is excluded from Mac App Store builds (Apple forbids self-updating
        // apps). Gated on the `mas` Cargo feature; the crate stays a dependency either way.
        #[cfg(not(feature = "mas"))]
        {
            builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        }
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let app_menu = menu::create(app.handle())?;
                app.set_menu(app_menu)?;
            }

            windows::setup(app)?;

            // Recover from iOS terminating the WKWebView content process while the app is
            // backgrounded, which otherwise leaves a blank page on resume.
            #[cfg(target_os = "ios")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    platform::ios::install_content_process_recovery(&window, app.handle());
                }
            }

            Ok(())
        })
        .manage(QuizState::default())
        .manage(TelemetryManager::default());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_cli::init());
    }

    #[cfg(desktop)]
    {
        builder = builder.invoke_handler(tauri::generate_handler!(
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese,
            open_character_window,
            export_list_data,
            import_list_data,
            import_reader_document,
            prepare_reader_import,
            tokenize_reader_text,
            start_quiz,
            get_next_question,
            answer_question,
            score_quiz,
            get_incorrect_questions,
            telemetry_init,
            telemetry_track_event,
            telemetry_track_screen,
            telemetry_track_error,
            telemetry_get_queued_events,
            telemetry_get_prefs,
            telemetry_set_pref,
            read_legacy_migration_file,
            pinyinify,
            convert_characters,
            prettify_pinyin,
            tokenize_pinyin,
            is_dev_build,
            is_mas_build,
            get_acknowledgements
        ));
    }
    #[cfg(mobile)]
    {
        builder = builder.invoke_handler(tauri::generate_handler!(
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese,
            export_list_data,
            import_list_data,
            import_reader_document,
            prepare_reader_import,
            tokenize_reader_text,
            start_quiz,
            get_next_question,
            answer_question,
            score_quiz,
            get_incorrect_questions,
            telemetry_init,
            telemetry_track_event,
            telemetry_track_screen,
            telemetry_track_error,
            telemetry_get_queued_events,
            telemetry_get_prefs,
            telemetry_set_pref,
            read_legacy_migration_file,
            pinyinify,
            convert_characters,
            prettify_pinyin,
            tokenize_pinyin,
            is_dev_build,
            is_mas_build,
            get_acknowledgements
        ));
    }

    #[cfg(desktop)]
    {
        builder = builder.on_menu_event(|app, event| {
            menu::handle_event(app, &event);
        });
    }

    builder
        .build(app_context)
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            match event {
                // Dock icon: NSApplicationDelegate applicationShouldHandleReopen
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                // Cmd-Tab and other activation paths do not always emit Reopen; if every
                // webview is hidden, bring the main window back when the app resumes.
                tauri::RunEvent::Resumed => {
                    let any_visible = app_handle
                        .webview_windows()
                        .values()
                        .any(|w| w.is_visible().unwrap_or(false));
                    if !any_visible {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}

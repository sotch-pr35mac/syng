#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod core;
#[cfg(desktop)]
mod menu;
mod platform;
mod system_typography;
mod utils;
mod windows;

#[cfg(desktop)]
use core::updater::check_for_update;
use core::{
    answer_question, classify, convert_characters, export_list_data, get_acknowledgements,
    get_incorrect_questions, get_next_question, get_region_options, import_list_data,
    import_reader_document, init_dictionary, interview_signup, interviews_init, is_dev_build,
    is_mas_build, persist_bookmark_recovery_report, pinyinify, prepare_reader_import,
    prettify_pinyin, query, query_by_chinese, query_by_english, query_by_id, query_by_ids,
    query_by_pinyin, read_bookmark_recovery_report, read_legacy_migration_file,
    resolve_legacy_lexical_units, save_bookmark_recovery_report, score_quiz, set_network_online,
    start_quiz, telemetry_get_prefs, telemetry_get_queued_events, telemetry_init,
    telemetry_sanitize_error, telemetry_set_pref, telemetry_track_error, telemetry_track_event,
    telemetry_track_screen, tokenize_pinyin, tokenize_reader_text, InterviewManager, NetworkStatus,
    QuizState, TelemetryManager,
};
use system_typography::get_system_typography;
#[cfg(any(desktop, target_os = "ios"))]
use tauri::Manager;
#[cfg(desktop)]
use windows::open_character_window;

fn app_context() -> tauri::Context<tauri::Wry> {
    tauri::generate_context!()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_context = app_context();
    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "linux")]
    let app_context = {
        let mut context = app_context;
        if platform::linux::configure_appimage_storage(
            context.config_mut(),
            std::env::var_os("APPIMAGE").as_deref(),
            std::env::var_os("APPDIR").as_deref(),
        ) {
            builder = builder.plugin(platform::linux::storage_plugin());
        }
        context
    };

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
        .manage(system_typography::SystemTypography::default())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            system_typography::install(app.handle());
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
        .manage(InterviewManager::default())
        .manage(TelemetryManager::default())
        .manage(NetworkStatus::default());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_cli::init());
    }

    #[cfg(desktop)]
    {
        builder = builder.invoke_handler(tauri::generate_handler!(
            get_system_typography,
            check_for_update,
            set_network_online,
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese,
            query_by_id,
            query_by_ids,
            resolve_legacy_lexical_units,
            open_character_window,
            export_list_data,
            import_list_data,
            persist_bookmark_recovery_report,
            read_bookmark_recovery_report,
            save_bookmark_recovery_report,
            import_reader_document,
            prepare_reader_import,
            tokenize_reader_text,
            start_quiz,
            get_next_question,
            answer_question,
            score_quiz,
            get_incorrect_questions,
            telemetry_init,
            interview_signup,
            interviews_init,
            telemetry_track_event,
            telemetry_track_screen,
            telemetry_track_error,
            telemetry_sanitize_error,
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
            get_acknowledgements,
            get_region_options
        ));
    }
    #[cfg(mobile)]
    {
        builder = builder.invoke_handler(tauri::generate_handler!(
            get_system_typography,
            set_network_online,
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese,
            query_by_id,
            query_by_ids,
            resolve_legacy_lexical_units,
            export_list_data,
            import_list_data,
            persist_bookmark_recovery_report,
            read_bookmark_recovery_report,
            save_bookmark_recovery_report,
            import_reader_document,
            prepare_reader_import,
            tokenize_reader_text,
            start_quiz,
            get_next_question,
            answer_question,
            score_quiz,
            get_incorrect_questions,
            telemetry_init,
            interview_signup,
            interviews_init,
            telemetry_track_event,
            telemetry_track_screen,
            telemetry_track_error,
            telemetry_sanitize_error,
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
            get_acknowledgements,
            get_region_options
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
            if matches!(&event, tauri::RunEvent::Exit) {
                system_typography::shutdown();
            }
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

#[cfg(test)]
mod asset_tests {
    #[test]
    fn embedded_app_allows_local_ipc_connections() {
        use std::collections::HashMap;
        use tauri::utils::config::CspDirectiveSources;

        let context = super::app_context();
        let policy: HashMap<String, CspDirectiveSources> = context
            .config()
            .app
            .security
            .csp
            .clone()
            .expect("Embedded pages must have a CSP")
            .into();
        let connections: Vec<String> = policy["connect-src"].clone().into();
        // Custom schemes on macOS/Linux/iOS; HTTP(S) origins on Windows/Android.
        for source in [
            "'self'",
            "ipc:",
            "http://ipc.localhost",
            "https://ipc.localhost",
        ] {
            assert!(connections.iter().any(|s| s == source), "Missing {source}");
        }
        for broad_source in ["*", "http:", "https:"] {
            assert!(!connections.iter().any(|s| s == broad_source));
        }
    }

    #[test]
    fn embedded_assets_include_shared_character_graphics() {
        // Desktop `make start` (with --no-dev-server) and release builds use these assets.
        // Check the real generated context, not a filesystem mock or a browser route stub.
        let context = super::app_context();
        assert!(context.config().build.dev_url.is_none());
        for (character, expected_strokes) in [('试', 8), ('考', 6), ('西', 6), ('要', 9)] {
            let path = format!("resources/hanzi-writer-data/data/{character}.json");
            let bytes = context
                .assets()
                .get(&path.as_str().into())
                .unwrap_or_else(|| panic!("Missing embedded asset: {path}"));
            let geometry: serde_json::Value = serde_json::from_slice(&bytes)
                .expect("Stroke requests must return JSON, not the index.html fallback");
            assert_eq!(
                geometry["strokes"].as_array().unwrap().len(),
                expected_strokes
            );
            assert_eq!(
                geometry["medians"].as_array().unwrap().len(),
                expected_strokes
            );
        }
    }
}

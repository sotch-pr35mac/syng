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
    answer_question, classify, export_list_data, get_incorrect_questions, get_next_question,
    import_list_data, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
    score_quiz, start_quiz, QuizState,
};
use windows::open_character_window;

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
            #[cfg(desktop)]
            {
                let app_menu = menu::create(app.handle())?;
                app.set_menu(app_menu)?;
            }

            windows::setup(app)?;

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
            menu::handle_event(app, &event);
        });
    }

    builder
        .build(app_context)
        .expect("error while building tauri application")
        .run(|_, _| {});
}

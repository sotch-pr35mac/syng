//! Core application features.
//!
//! This module contains the primary business logic and Tauri command handlers
//! for the application's main features: dictionary lookup, I/O operations, and quizzes.

pub mod acknowledgements;
pub mod dictionary;
pub mod io;
pub mod migration;
pub mod quiz;
pub mod reader;
pub mod telemetry;
pub mod tools;

#[tauri::command]
pub fn is_dev_build() -> bool {
    crate::utils::build::is_development()
}

/// Whether this binary was built for the Mac App Store (`--features mas`). MAS builds exclude the
/// self-updater, so the frontend uses this to hide the in-app Updates UI.
#[tauri::command]
pub fn is_mas_build() -> bool {
    cfg!(feature = "mas")
}

// Re-export commonly used items for convenience
pub use acknowledgements::get_acknowledgements;
pub use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
pub use io::{export_list_data, import_list_data};
pub use migration::read_legacy_migration_file;
pub use quiz::{
    answer_question, get_incorrect_questions, get_next_question, score_quiz, start_quiz, QuizState,
};
pub use reader::{import_reader_document, prepare_reader_import, tokenize_reader_text};
#[cfg(target_os = "ios")]
pub use telemetry::track_event_native;
pub use telemetry::{
    telemetry_get_prefs, telemetry_get_queued_events, telemetry_init, telemetry_set_pref,
    telemetry_track_error, telemetry_track_event, telemetry_track_screen, TelemetryManager,
};
pub use tools::{convert_characters, pinyinify, prettify_pinyin, tokenize_pinyin};

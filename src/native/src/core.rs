//! Core application features.
//!
//! This module contains the primary business logic and Tauri command handlers
//! for the application's main features: dictionary lookup, I/O operations, and quizzes.

pub mod dictionary;
pub mod io;
pub mod quiz;
pub mod telemetry;

#[tauri::command]
pub fn is_dev_build() -> bool {
    cfg!(debug_assertions)
}

// Re-export commonly used items for convenience
pub use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
pub use io::{export_list_data, import_list_data};
pub use quiz::{
    answer_question, get_incorrect_questions, get_next_question, score_quiz, start_quiz, QuizState,
};
pub use telemetry::{
    telemetry_get_prefs, telemetry_get_queued_events, telemetry_init, telemetry_set_pref,
    telemetry_track_error, telemetry_track_event, telemetry_track_screen, TelemetryManager,
};

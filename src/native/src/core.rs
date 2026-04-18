//! Core application features.
//!
//! This module contains the primary business logic and Tauri command handlers
//! for the application's main features: dictionary lookup, I/O operations, and quizzes.

pub mod dictionary;
pub mod io;
pub mod quiz;

// Re-export commonly used items for convenience
pub use dictionary::{
    classify, init_dictionary, query, query_by_chinese, query_by_english, query_by_pinyin,
};
pub use io::{export_list_data, import_list_data};
pub use quiz::{
    answer_question, get_incorrect_questions, get_next_question, score_quiz, start_quiz, QuizState,
};

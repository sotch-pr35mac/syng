#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
extern crate chinese_dictionary;

use chinese_dictionary as cd;
use serde::Serialize;
use std::sync::Once;
use tauri::Manager;

static INIT: Once = Once::new();

#[derive(Serialize)]
struct MeasureWord {
    traditional: String,
    simplified: String,
    pinyin_marks: String,
    pinyin_numbers: String,
}

#[derive(Serialize)]
struct WordEntry {
    traditional: String,
    simplified: String,
    pinyin_marks: String,
    pinyin_numbers: String,
    english: Vec<String>,
    tone_marks: Vec<u8>,
    hash: u64,
    measure_words: Vec<MeasureWord>,
    hsk: u8,
    word_id: u32,
}

impl From<cd::MeasureWord> for MeasureWord {
    fn from(mw: cd::MeasureWord) -> Self {
        Self {
            traditional: mw.traditional,
            simplified: mw.simplified,
            pinyin_marks: mw.pinyin_marks,
            pinyin_numbers: mw.pinyin_numbers,
        }
    }
}

impl From<cd::WordEntry> for WordEntry {
    fn from(we: cd::WordEntry) -> Self {
        Self {
            traditional: we.traditional,
            simplified: we.simplified,
            pinyin_marks: we.pinyin_marks,
            pinyin_numbers: we.pinyin_numbers,
            english: we.english,
            tone_marks: we.tone_marks,
            hash: we.hash,
            measure_words: we.measure_words.into_iter().map(|x| x.into()).collect(),
            hsk: we.hsk,
            word_id: we.word_id,
        }
    }
}

#[tauri::command]
fn classify(text: String) -> Result<String, String> {
    match cd::classify(&text) {
        cd::ClassificationResult::ZH => Ok("ZH".to_string()),
        cd::ClassificationResult::EN => Ok("EN".to_string()),
        cd::ClassificationResult::PY => Ok("PY".to_string()),
        cd::ClassificationResult::UN => Err(format!("Could not classify {}, uncertain.", text)),
    }
}

#[tauri::command(async)]
fn init_dictionary() {
    INIT.call_once(|| {
        cd::init();
    });
}

#[tauri::command]
fn query(text: String) -> Vec<WordEntry> {
    match cd::query(&text) {
        Some(results) => results.into_iter().map(|x| x.clone().into()).collect(),
        None => vec![],
    }
}

#[tauri::command]
fn query_by_chinese(text: String) -> Vec<WordEntry> {
    cd::query_by_chinese(&text)
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

#[tauri::command]
fn query_by_pinyin(text: String) -> Vec<WordEntry> {
    cd::query_by_pinyin(&text)
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

#[tauri::command]
fn query_by_english(text: String) -> Vec<WordEntry> {
    cd::query_by_english(&text)
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.open_devtools();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler!(
            init_dictionary,
            classify,
            query,
            query_by_english,
            query_by_pinyin,
            query_by_chinese
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

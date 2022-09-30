#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
extern crate chinese_dictionary;

use chinese_dictionary as cd;
use serde::Serialize;
use std::sync::Once;
use tauri::{Manager, Runtime, Window};

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
    match cd::classify(text.trim()) {
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
    match cd::query(text.trim()) {
        Some(results) => results.into_iter().map(|x| x.clone().into()).collect(),
        None => vec![],
    }
}

#[tauri::command]
fn query_by_chinese(text: String) -> Vec<WordEntry> {
    cd::query_by_chinese(text.trim())
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

#[tauri::command]
fn query_by_pinyin(text: String) -> Vec<WordEntry> {
    cd::query_by_pinyin(text.trim())
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

#[tauri::command]
fn query_by_english(text: String) -> Vec<WordEntry> {
    cd::query_by_english(text.trim())
        .into_iter()
        .map(|x| x.clone().into())
        .collect()
}

pub enum ToolbarThickness {
    Thick,
    Medium,
    Thin,
}

pub trait WindowExt {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness);
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
}

#[cfg(target_os = "macos")]
unsafe fn make_toolbar(id: cocoa::base::id) {
    use cocoa::appkit::{NSToolbar, NSWindow};

    let new_toolbar = NSToolbar::alloc(id);
    new_toolbar.init_();
    id.setToolbar_(new_toolbar);
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_transparent_titlebar(ToolbarThickness::Thick);
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

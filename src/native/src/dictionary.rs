use chinese_dictionary as dictionary;
use std::sync::Once;

static INIT: Once = Once::new();

#[tauri::command]
pub fn classify(text: String) -> Result<String, String> {
    match dictionary::classify(text.trim()) {
        dictionary::ClassificationResult::ZH => Ok("ZH".to_string()),
        dictionary::ClassificationResult::EN => Ok("EN".to_string()),
        dictionary::ClassificationResult::PY => Ok("PY".to_string()),
        dictionary::ClassificationResult::UN => {
            Err(format!("Could not classify {}, uncertain.", text))
        }
    }
}

#[tauri::command(async)]
pub fn init_dictionary() {
    INIT.call_once(|| {
        dictionary::init();
    });
}

#[tauri::command]
pub fn query(text: String) -> Vec<&'static dictionary::WordEntry> {
    match dictionary::query(text.trim()) {
        Some(results) => results,
        None => vec![],
    }
}

#[tauri::command]
pub fn query_by_chinese(text: String) -> Vec<&'static dictionary::WordEntry> {
    dictionary::query_by_chinese(text.trim())
}

#[tauri::command]
pub fn query_by_pinyin(text: String) -> Vec<&'static dictionary::WordEntry> {
    dictionary::query_by_pinyin(text.trim())
}

#[tauri::command]
pub fn query_by_english(text: String) -> Vec<&'static dictionary::WordEntry> {
    dictionary::query_by_english(text.trim())
}

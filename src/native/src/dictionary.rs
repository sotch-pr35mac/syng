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
pub async fn init_dictionary() {
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

pub fn find_best_match(
    traditional: &str,
    simplified: &str,
    tone_marks: &Vec<u8>,
    en_len: usize,
) -> Option<&'static dictionary::WordEntry> {
    let results = dictionary::query_by_chinese(traditional);
    let filtered_results: Vec<_> = results
        .into_iter()
        .filter(|result| {
            result.traditional == traditional
                && result.simplified == simplified
                && &result.tone_marks == tone_marks
                && result.english.len() == en_len
        })
        .collect();
    if !filtered_results.is_empty() {
        filtered_results.into_iter().next()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_best_match() {
        assert_eq!(
            find_best_match("上水", "上水", &vec![4 as u8, 3 as u8], 4)
                .unwrap()
                .traditional,
            "上水".to_string()
        );
    }
    #[test]
    fn test_best_match_no_match() {
        assert_eq!(find_best_match("上水", "水上", &vec![], 1), None);
    }
}

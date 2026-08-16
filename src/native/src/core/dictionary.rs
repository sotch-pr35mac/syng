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
    dictionary::query(text.trim()).unwrap_or_default()
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
    tone_marks: &[u8],
    en_len: usize,
) -> Option<&'static dictionary::WordEntry> {
    dictionary::query_by_chinese(traditional)
        .into_iter()
        .find(|result| {
            result.traditional == traditional
                && result.simplified == simplified
                && result.tone_marks == tone_marks
                && result.english.len() == en_len
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn test_affected_chinese_queries_return_exact_headwords() {
        for (text, simplified, traditional) in [
            ("以后", "以后", "以後"),
            ("以後", "以后", "以後"),
            ("用于", "用于", "用於"),
            ("用於", "用于", "用於"),
            ("万", "万", "萬"),
            ("萬", "万", "萬"),
            ("舍不得", "舍不得", "捨不得"),
            ("捨不得", "舍不得", "捨不得"),
        ] {
            let results = query(text.to_string());

            assert!(
                results.iter().any(|entry| {
                    entry.simplified == simplified && entry.traditional == traditional
                }),
                "Missing exact Chinese headword for {text:?}"
            );
        }
    }

    #[test]
    fn test_ambiguous_chinese_query_returns_unique_union() {
        let results = query_by_chinese("万".to_string());
        let unique_ids: HashSet<u32> = results.iter().map(|entry| entry.word_id).collect();

        assert_eq!(3, results.len());
        assert_eq!(results.len(), unique_ids.len());
    }

    #[test]
    fn test_best_match() {
        assert_eq!(
            find_best_match("上水", "上水", &[4u8, 3u8], 4)
                .unwrap()
                .traditional,
            "上水".to_string()
        );
    }
    #[test]
    fn test_best_match_no_match() {
        assert_eq!(find_best_match("上水", "水上", &[], 1), None);
    }
}

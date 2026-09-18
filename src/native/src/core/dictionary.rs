use chinese_dictionary as dictionary;
use serde::{Deserialize, Serialize};
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
pub fn query(text: String) -> Vec<dictionary::LexicalUnit> {
    dictionary::query(text.trim())
        .unwrap_or_default()
        .into_iter()
        .map(dictionary::LexicalUnitRef::to_owned)
        .collect()
}

#[tauri::command]
pub fn query_by_chinese(text: String) -> Vec<dictionary::LexicalUnit> {
    dictionary::query_by_chinese(text.trim())
        .into_iter()
        .map(dictionary::LexicalUnitRef::to_owned)
        .collect()
}

#[tauri::command]
pub fn query_by_pinyin(text: String) -> Vec<dictionary::LexicalUnit> {
    dictionary::query_by_pinyin(text.trim())
        .into_iter()
        .map(dictionary::LexicalUnitRef::to_owned)
        .collect()
}

#[tauri::command]
pub fn query_by_english(text: String) -> Vec<dictionary::LexicalUnit> {
    dictionary::query_by_english(text.trim())
        .into_iter()
        .map(dictionary::LexicalUnitRef::to_owned)
        .collect()
}

/// Looks up one versioned lexical ID. Invalid or unknown IDs deliberately return no result.
#[tauri::command]
pub fn query_by_id(id: String) -> Option<dictionary::LexicalUnit> {
    dictionary::query_by_id_str(id.trim()).map(dictionary::LexicalUnitRef::to_owned)
}

/// Looks up lexical IDs in request order. Missing or invalid IDs stay as `null` so callers can
/// retain their PouchDB ordering while safely omitting entries that no longer resolve.
#[tauri::command]
pub fn query_by_ids(ids: Vec<String>) -> Vec<Option<dictionary::LexicalUnit>> {
    ids.into_iter().map(query_by_id).collect()
}

#[derive(Debug, Deserialize)]
pub struct LegacyLexicalUnit {
    pub simplified: String,
    pub traditional: String,
    #[serde(default)]
    pub pinyin_numbers: String,
    #[serde(default)]
    pub tone_marks: Vec<u8>,
    #[serde(default)]
    pub english: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LegacyLexicalUnitResolution {
    pub unit: Option<dictionary::LexicalUnit>,
    pub reason: Option<String>,
}

/// Converts legacy bookmark/import fields into a canonical schema-4 unit.
///
/// We always try `LexicalId::new` first and validate it against the current archive. The old
/// matching heuristic is intentionally only a fallback for legacy records whose Pinyin cannot
/// construct an identity, and it succeeds only when exactly one current unit matches.
pub fn resolve_legacy_lexical_unit(legacy: LegacyLexicalUnit) -> LegacyLexicalUnitResolution {
    if let Ok(id) = dictionary::LexicalId::new(
        &legacy.simplified,
        &legacy.traditional,
        &legacy.pinyin_numbers,
    ) {
        if let Some(unit) = dictionary::query_by_id(&id) {
            return LegacyLexicalUnitResolution {
                unit: Some(unit.to_owned()),
                reason: None,
            };
        }
    }

    let matches = dictionary::query_by_chinese(&legacy.traditional)
        .into_iter()
        .filter(|unit| {
            unit.simplified() == legacy.simplified && unit.traditional() == legacy.traditional
        })
        .filter(|unit| {
            legacy.tone_marks.is_empty() || unit.pinyin().tones() == legacy.tone_marks.as_slice()
        })
        .filter(|unit| legacy.english.is_empty() || unit.english().count() == legacy.english.len())
        .collect::<Vec<_>>();

    match matches.as_slice() {
        [unit] => LegacyLexicalUnitResolution {
            unit: Some((*unit).to_owned()),
            reason: None,
        },
        [] => LegacyLexicalUnitResolution {
            unit: None,
            reason: Some("No matching current dictionary entry was found.".to_string()),
        },
        _ => LegacyLexicalUnitResolution {
            unit: None,
            reason: Some(
                "More than one current dictionary entry matched this legacy record.".to_string(),
            ),
        },
    }
}

#[tauri::command]
pub fn resolve_legacy_lexical_units(
    entries: Vec<LegacyLexicalUnit>,
) -> Vec<LegacyLexicalUnitResolution> {
    entries
        .into_iter()
        .map(resolve_legacy_lexical_unit)
        .collect()
}

#[cfg(test)]
pub fn find_best_match(
    traditional: &str,
    simplified: &str,
    tone_marks: &[u8],
    en_len: usize,
) -> Option<dictionary::LexicalUnitRef<'static>> {
    dictionary::query_by_chinese(traditional)
        .into_iter()
        .find(|result| {
            result.traditional() == traditional
                && result.simplified() == simplified
                && result.pinyin().tones() == tone_marks
                && result.english().count() == en_len
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn result_ids(text: &str) -> Vec<dictionary::LexicalId> {
        query(text.to_string())
            .into_iter()
            .map(|entry| entry.id)
            .collect()
    }

    #[test]
    fn test_punctuation_does_not_change_english_or_pinyin_queries() {
        for (plain, punctuated, expected_language) in [
            ("watermelon", "watermelon.", "EN"),
            ("watermelon", ".watermelon", "EN"),
            ("watermelon", "\"watermelon\"", "EN"),
            ("ni hao", "ni hao.", "PY"),
            ("ni hao", "ni hao。", "PY"),
            ("nihao", "nihao.", "PY"),
        ] {
            let plain_ids = result_ids(plain);

            assert!(
                !plain_ids.is_empty(),
                "Baseline query {plain:?} returned no results"
            );
            assert_eq!(
                expected_language,
                classify(punctuated.to_string()).unwrap(),
                "Punctuation changed the classification of {punctuated:?}"
            );
            assert_eq!(
                plain_ids,
                result_ids(punctuated),
                "Punctuation changed the results for {punctuated:?}"
            );
        }
    }

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
        let unique_ids: HashSet<dictionary::LexicalId> =
            results.iter().map(|entry| entry.id).collect();

        assert_eq!(3, results.len());
        assert_eq!(results.len(), unique_ids.len());
    }

    #[test]
    fn test_best_match() {
        assert_eq!(
            find_best_match("上水", "上水", &[4u8, 3u8], 4)
                .unwrap()
                .traditional(),
            "上水"
        );
    }
    #[test]
    fn test_best_match_no_match() {
        assert_eq!(find_best_match("上水", "水上", &[], 1), None);
    }

    #[test]
    fn lexical_id_lookups_validate_and_preserve_batch_order() {
        let unit = query_by_chinese("西瓜".to_string())
            .into_iter()
            .next()
            .expect("Expected 西瓜 dictionary fixture");
        let unit_id = unit.id.to_string();

        assert_eq!(
            query_by_id(unit_id.clone()).as_ref().map(|entry| entry.id),
            Some(unit.id)
        );
        assert_eq!(query_by_id("not-a-lexical-id".to_string()), None);

        let batch = query_by_ids(vec!["not-a-lexical-id".to_string(), unit_id]);
        assert_eq!(batch[0], None);
        assert_eq!(batch[1].as_ref().map(|entry| entry.id), Some(unit.id));
    }

    #[test]
    fn legacy_resolution_uses_the_constructed_id_then_an_unambiguous_fallback() {
        let unit = query_by_chinese("上水".to_string())
            .into_iter()
            .find(|entry| entry.pinyin.tones == [4, 3])
            .expect("Expected 上水 dictionary fixture");
        let canonical = resolve_legacy_lexical_unit(LegacyLexicalUnit {
            simplified: unit.simplified.clone(),
            traditional: unit.traditional.clone(),
            pinyin_numbers: unit.pinyin.numbers.clone(),
            tone_marks: unit.pinyin.tones.clone(),
            english: unit
                .english
                .iter()
                .map(|definition| definition.gloss.value.clone())
                .collect(),
        });
        assert_eq!(canonical.unit.as_ref().map(|entry| entry.id), Some(unit.id));

        let fallback = resolve_legacy_lexical_unit(LegacyLexicalUnit {
            simplified: unit.simplified.clone(),
            traditional: unit.traditional.clone(),
            pinyin_numbers: String::new(),
            tone_marks: unit.pinyin.tones.clone(),
            english: unit
                .english
                .iter()
                .map(|definition| definition.gloss.value.clone())
                .collect(),
        });
        assert_eq!(fallback.unit.as_ref().map(|entry| entry.id), Some(unit.id));
    }
}

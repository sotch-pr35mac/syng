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

/// Field-based bookmark and import data from releases before schema 4.
///
/// Retained only to deserialize legacy records so they can be resolved to the current,
/// versioned lexical IDs; new bookmarks and exports do not persist this representation.
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
/// Validate a constructed lexical ID first, then use spelling, tones, and actual glosses
/// to resolve legacy records without guessing between multiple readings.
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

    let mut matches = dictionary::query_by_chinese(&legacy.traditional)
        .into_iter()
        .filter(|unit| {
            unit.simplified() == legacy.simplified && unit.traditional() == legacy.traditional
        })
        .filter(|unit| {
            legacy.tone_marks.is_empty() || unit.pinyin().tones() == legacy.tone_marks.as_slice()
        })
        .collect::<Vec<_>>();

    if matches.len() > 1 {
        let legacy_glosses = legacy
            .english
            .iter()
            .map(|gloss| normalize_legacy_gloss(gloss))
            .filter(|gloss| !gloss.is_empty())
            .collect::<Vec<_>>();
        matches.retain(|unit| {
            unit.english().any(|definition| {
                legacy_glosses.contains(&normalize_legacy_gloss(definition.gloss().value()))
            })
        });
    }

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

fn normalize_legacy_gloss(gloss: &str) -> String {
    gloss
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
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
    fn legacy_bank_resolves_despite_expanded_definitions() {
        for english in [vec!["bank".to_string()], vec![]] {
            let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
                simplified: "银行".to_string(),
                traditional: "銀行".to_string(),
                pinyin_numbers: String::new(),
                tone_marks: vec![2, 2],
                english,
            });
            assert_eq!(resolution.unit.unwrap().pinyin.numbers, "yin2hang2");
        }
    }

    #[test]
    fn legacy_readings_are_disambiguated_by_glosses_not_counts() {
        let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
            simplified: "数".to_string(),
            traditional: "數".to_string(),
            pinyin_numbers: String::new(),
            tone_marks: vec![4],
            english: vec!["  NUMBER ".to_string(), "figure".to_string()],
        });
        assert_eq!(resolution.unit.unwrap().pinyin.numbers, "shu4");
    }

    #[test]
    fn legacy_readings_without_unique_gloss_evidence_remain_unresolved() {
        for english in [
            vec![],
            vec!["not a dictionary gloss".to_string()],
            vec!["number".to_string(), "frequently".to_string()],
        ] {
            let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
                simplified: "数".to_string(),
                traditional: "數".to_string(),
                pinyin_numbers: String::new(),
                tone_marks: vec![4],
                english,
            });
            assert!(resolution.unit.is_none());
            assert!(resolution.reason.is_some());
        }
    }

    #[test]
    fn validated_lexical_identity_takes_precedence_over_legacy_glosses() {
        let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
            simplified: "数".to_string(),
            traditional: "數".to_string(),
            pinyin_numbers: "shu4".to_string(),
            tone_marks: vec![4],
            english: vec!["frequently".to_string()],
        });
        assert_eq!(resolution.unit.unwrap().pinyin.numbers, "shu4");
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

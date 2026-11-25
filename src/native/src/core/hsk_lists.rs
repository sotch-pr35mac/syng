//! Precomputed lists derived from the bundled dictionary's existing HSK memberships.
//! Runtime import reads these IDs directly; it never scans or rebuilds the dictionary.
use chinese_dictionary::HskLevel;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Deserialize)]
struct HskCatalog {
    lists: Vec<HskList>,
}

#[derive(Deserialize)]
struct HskList {
    id: String,
    standard: String,
    level: HskLevel,
    lexical_ids: Vec<String>,
}

#[derive(Serialize)]
pub struct HskListSummary {
    id: String,
    standard: String,
    level: HskLevel,
    word_count: usize,
}

fn catalog() -> Result<&'static HskCatalog, String> {
    static CATALOG: OnceLock<Result<HskCatalog, String>> = OnceLock::new();
    CATALOG
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../resources/hsk-lists.json"))
                .map_err(|_| "The built-in HSK lists could not be loaded.".to_owned())
        })
        .as_ref()
        .map_err(Clone::clone)
}

#[tauri::command(async)]
pub fn get_hsk_lists() -> Result<Vec<HskListSummary>, String> {
    Ok(catalog()?
        .lists
        .iter()
        .map(|list| HskListSummary {
            id: list.id.clone(),
            standard: list.standard.clone(),
            level: list.level,
            word_count: list.lexical_ids.len(),
        })
        .collect())
}

#[tauri::command(async)]
pub fn prepare_hsk_list(id: String) -> Result<Vec<String>, String> {
    catalog()?
        .lists
        .iter()
        .find(|list| list.id == id)
        .map(|list| list.lexical_ids.clone())
        .ok_or_else(|| "This built-in HSK list is unavailable.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packaged_lists_match_the_exact_dictionary_bundle_and_memberships() {
        let data: serde_json::Value =
            serde_json::from_str(include_str!("../../resources/hsk-lists.json")).unwrap();
        let manifest: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CHINESE_DICTIONARY_DATA_DIR"),
            "/manifest.json"
        )))
        .unwrap();
        assert_eq!(data["dictionary_version"], manifest["bundle_version"]);
        assert_eq!(
            data["dictionary_sha256"],
            manifest["file_checksums"]["dictionary.rkyv.zst"]
        );
        assert_eq!(catalog().unwrap().lists.len(), 20);
        let mut list_ids = std::collections::HashSet::new();
        for list in &catalog().unwrap().lists {
            assert!(list_ids.insert(&list.id));
            assert!(!list.lexical_ids.is_empty());
            assert!(list.lexical_ids.windows(2).all(|pair| pair[0] < pair[1]));
            for id in &list.lexical_ids {
                let entry =
                    chinese_dictionary::query_by_id_str(id).expect("packaged ID must exist");
                let memberships = entry.hsk();
                let included = match list.standard.as_str() {
                    "hsk_2015" => memberships.hsk_2015().any(|level| level == list.level),
                    "proficiency_standard_2021" => memberships
                        .proficiency_standard_2021()
                        .any(|level| level == list.level),
                    "hsk_exam_syllabus_2025" => memberships
                        .hsk_exam_syllabus_2025()
                        .any(|level| level == list.level),
                    _ => panic!("Unknown HSK standard"),
                };
                assert!(included, "{id} is not a member of {}", list.id);
            }
        }
    }

    #[test]
    fn preparation_returns_only_the_requested_level_and_rejects_unknown_lists() {
        let summaries = get_hsk_lists().unwrap();
        for summary in summaries {
            assert_eq!(
                prepare_hsk_list(summary.id).unwrap().len(),
                summary.word_count
            );
        }
        assert!(prepare_hsk_list("hsk_2015:SevenToNine".into()).is_err());
        assert!(prepare_hsk_list("../other-file".into()).is_err());
    }
}

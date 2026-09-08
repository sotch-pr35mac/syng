use super::dictionary::find_best_match;
use super::hsk::levels_value;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Write;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FsExt, OpenOptions};

#[derive(Debug, Deserialize, Serialize)]
pub enum BookmarksExportVersion {
    V1,
    V2,
    V3,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct MeasureWord {
    traditional: String,
    simplified: String,
    pinyin_marks: String,
    pinyin_numbers: String,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct BookmarkEntry {
    english: Vec<String>,
    hash: u64,
    hsk: chinese_dictionary::HskLevels,
    measure_words: Vec<MeasureWord>,
    notes: String,
    pinyin_marks: String,
    pinyin_numbers: String,
    simplified: String,
    tone_marks: Vec<u8>,
    traditional: String,
    word_id: u32,
}

/// The archive shape deliberately accepts any historical `hsk` JSON. Imported HSK data is
/// recomputed from the canonical word and numbered pinyin instead of being trusted or exposed.
#[derive(Debug, Deserialize)]
struct ArchivedBookmarkEntry {
    english: Vec<String>,
    hash: u64,
    #[serde(rename = "hsk")]
    #[serde(default)]
    _legacy_hsk: serde_json::Value,
    measure_words: Vec<MeasureWord>,
    notes: String,
    pinyin_marks: String,
    pinyin_numbers: String,
    simplified: String,
    tone_marks: Vec<u8>,
    traditional: String,
    word_id: u32,
}

#[derive(Debug, Deserialize, Serialize, Hash)]
pub struct V1BookmarkEntry {
    traditional: String,
    simplified: String,
    definitions: Vec<String>,
    #[serde(rename = "toneMarks")]
    tone_marks: Vec<u8>,
    notes: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BookmarksExportMeta {
    version: BookmarksExportVersion,
    name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BookmarksExport {
    meta: BookmarksExportMeta,
    entries: Vec<BookmarkEntry>,
}

#[derive(Debug, Deserialize)]
struct ArchivedBookmarksExport {
    meta: BookmarksExportMeta,
    entries: Vec<ArchivedBookmarkEntry>,
}

impl From<&chinese_dictionary::MeasureWord> for MeasureWord {
    fn from(original: &chinese_dictionary::MeasureWord) -> Self {
        Self {
            traditional: original.traditional.clone(),
            simplified: original.simplified.clone(),
            pinyin_marks: original.pinyin_marks.clone(),
            pinyin_numbers: original.pinyin_numbers.clone(),
        }
    }
}

impl From<V1BookmarkEntry> for BookmarkEntry {
    fn from(original: V1BookmarkEntry) -> Self {
        let def_len = original
            .definitions
            .iter()
            .filter(|val| !val.contains("CL"))
            .count();
        match find_best_match(
            &original.traditional,
            &original.simplified,
            &original.tone_marks,
            def_len,
        ) {
            Some(best_match) => Self {
                english: best_match.english.clone(),
                hash: best_match.hash,
                hsk: levels_value(&best_match.simplified, &best_match.pinyin_numbers),
                measure_words: best_match
                    .measure_words
                    .iter()
                    .map(MeasureWord::from)
                    .collect(),
                notes: original.notes.clone(),
                pinyin_marks: best_match.pinyin_marks.clone(),
                pinyin_numbers: best_match.pinyin_numbers.clone(),
                simplified: best_match.simplified.clone(),
                tone_marks: best_match.tone_marks.clone(),
                traditional: best_match.traditional.clone(),
                word_id: best_match.word_id,
            },
            None => {
                let original_hash = {
                    let mut hasher = DefaultHasher::new();
                    original.hash(&mut hasher);
                    hasher.finish()
                };
                Self {
                    english: original.definitions.clone(),
                    hash: original_hash,
                    hsk: chinese_dictionary::HskLevels::default(),
                    measure_words: vec![],
                    notes: original.notes.clone(),
                    pinyin_marks: "Pinyin not found".to_string(),
                    pinyin_numbers: "Pinyin not found".to_string(),
                    simplified: original.simplified.clone(),
                    tone_marks: original.tone_marks.clone(),
                    traditional: original.traditional.clone(),
                    word_id: 0,
                }
            }
        }
    }
}

impl From<ArchivedBookmarkEntry> for BookmarkEntry {
    fn from(original: ArchivedBookmarkEntry) -> Self {
        Self {
            hsk: levels_value(&original.simplified, &original.pinyin_numbers),
            english: original.english,
            hash: original.hash,
            measure_words: original.measure_words,
            notes: original.notes,
            pinyin_marks: original.pinyin_marks,
            pinyin_numbers: original.pinyin_numbers,
            simplified: original.simplified,
            tone_marks: original.tone_marks,
            traditional: original.traditional,
            word_id: original.word_id,
        }
    }
}

fn parse_bookmarks_export(file: &str) -> serde_json::Result<BookmarksExport> {
    serde_json::from_str::<ArchivedBookmarksExport>(file).map(|archive| BookmarksExport {
        meta: archive.meta,
        entries: archive
            .entries
            .into_iter()
            .map(BookmarkEntry::from)
            .collect(),
    })
}

fn normalize_bookmark_entry(mut entry: BookmarkEntry) -> BookmarkEntry {
    entry.hsk = levels_value(&entry.simplified, &entry.pinyin_numbers);
    entry
}

#[tauri::command(async)]
pub async fn export_list_data(
    app: tauri::AppHandle,
    name: String,
    data: Vec<BookmarkEntry>,
) -> Result<(), String> {
    let file_path = app
        .dialog()
        .file()
        .set_title("Save Vocabulary List")
        .add_filter("Syng List Formats", &["sld", "syli"])
        .set_file_name(format!("{}.syli", name))
        .blocking_save_file();
    if let Some(file_path) = file_path {
        let export = BookmarksExport {
            meta: BookmarksExportMeta {
                name,
                version: BookmarksExportVersion::V3,
            },
            entries: data.into_iter().map(normalize_bookmark_entry).collect(),
        };
        let export_data = serde_json::to_string(&export)
            .map_err(|err| format!("Could not prepare data for export: {}", err))?;

        let mut open_options = OpenOptions::new();
        open_options.write(true).create(true).truncate(true);
        let mut file = app
            .fs()
            .open(file_path, open_options)
            .map_err(|err| format!("Could not open the export file: {}", err))?;
        file.write_all(export_data.as_bytes())
            .map_err(|err| format!("Could not write export to the specified file: {}", err))?;
    }

    Ok(())
}

#[tauri::command(async)]
pub async fn import_list_data(app: tauri::AppHandle) -> Result<Option<BookmarksExport>, String> {
    let file_path = app
        .dialog()
        .file()
        .set_title("Import Syng Vocabulary List")
        .add_filter("Syng List Formats", &["sld", "syli"])
        .blocking_pick_file();

    if let Some(file_path) = file_path {
        let file_path_display = file_path.to_string();
        let extension = file_path_display
            .rsplit_once('.')
            .map(|(_, extension)| extension);
        let file = app
            .fs()
            .read_to_string(file_path)
            .map_err(|err| format!("Failed to read from file: {}", err))?;
        return match extension {
            Some("sld") => {
                let content: Vec<BookmarkEntry> = file
                    .split('\n')
                    .filter_map(|line| {
                        serde_json::from_str::<V1BookmarkEntry>(line)
                            .ok()
                            .map(BookmarkEntry::from)
                    })
                    .collect();
                Ok(Some(BookmarksExport {
                    meta: BookmarksExportMeta {
                        version: BookmarksExportVersion::V2,
                        name: "Imported List".to_string(),
                    },
                    entries: content,
                }))
            }
            Some("syli") => parse_bookmarks_export(&file)
                .map(Some)
                .map_err(|err| format!("Could not read from file: {}", err)),
            _ => {
                // On Android, content URIs don't include file extensions.
                // Try parsing as V2 (syli/JSON) first, then fall back to V1 (sld).
                if let Ok(export) = parse_bookmarks_export(&file) {
                    Ok(Some(export))
                } else {
                    let content: Vec<BookmarkEntry> = file
                        .split('\n')
                        .filter_map(|line| {
                            serde_json::from_str::<V1BookmarkEntry>(line)
                                .ok()
                                .map(BookmarkEntry::from)
                        })
                        .collect();
                    if content.is_empty() {
                        Err("Unsupported file type".to_string())
                    } else {
                        Ok(Some(BookmarksExport {
                            meta: BookmarksExportMeta {
                                version: BookmarksExportVersion::V2,
                                name: "Imported List".to_string(),
                            },
                            entries: content,
                        }))
                    }
                }
            }
        };
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_v1_bookmark_entry_match() {
        let expected_word_id = find_best_match("上水", "上水", &[4, 3], 4)
            .expect("Expected 上水 dictionary fixture")
            .word_id;
        let original = V1BookmarkEntry {
            traditional: "上水".to_string(),
            simplified: "上水".to_string(),
            definitions: vec![
                "upper reaches (of a river)".to_string(),
                "to go upstream".to_string(),
                "to add some water".to_string(),
                "to water (a crop etc)".to_string(),
            ],
            tone_marks: vec![4u8, 3u8],
            notes: "This is a test".to_string(),
        };
        let converted = BookmarkEntry::from(original);
        assert_eq!(
            converted,
            BookmarkEntry {
                english: vec![
                    "upper reaches (of a river)".to_string(),
                    "to go upstream".to_string(),
                    "to add some water".to_string(),
                    "to water (a crop etc)".to_string()
                ],
                hash: 9216539338582081123,
                hsk: chinese_dictionary::HskLevels::default(),
                measure_words: vec![],
                notes: "This is a test".to_string(),
                pinyin_marks: "shàng shuǐ".to_string(),
                pinyin_numbers: "shang4 shui3".to_string(),
                simplified: "上水".to_string(),
                tone_marks: vec![4u8, 3u8],
                traditional: "上水".to_string(),
                word_id: expected_word_id
            }
        );
    }

    #[test]
    fn test_convert_v1_bookmark_entry_no_match() {
        let original = V1BookmarkEntry {
            traditional: "上水".to_string(),
            simplified: "上水".to_string(),
            definitions: vec!["Totally made up word.".to_string()],
            tone_marks: vec![1u8, 2u8],
            notes: "This word doesn't exist.".to_string(),
        };
        let converted = BookmarkEntry::from(original);
        assert_eq!(
            converted,
            BookmarkEntry {
                english: vec!["Totally made up word.".to_string()],
                hash: 16059756997626313037,
                hsk: chinese_dictionary::HskLevels::default(),
                measure_words: vec![],
                notes: "This word doesn't exist.".to_string(),
                pinyin_marks: "Pinyin not found".to_string(),
                pinyin_numbers: "Pinyin not found".to_string(),
                simplified: "上水".to_string(),
                tone_marks: vec![1u8, 2u8],
                traditional: "上水".to_string(),
                word_id: 0
            }
        );
    }

    #[test]
    fn legacy_numeric_hsk_archives_are_recomputed_into_typed_levels() {
        let archive = serde_json::json!({
            "meta": { "version": "V2", "name": "Legacy" },
            "entries": [{
                "english": ["to love"],
                "hash": 1,
                "hsk": 1,
                "measure_words": [],
                "notes": "",
                "pinyin_marks": "ài",
                "pinyin_numbers": "ai4",
                "simplified": "爱",
                "tone_marks": [4],
                "traditional": "愛",
                "word_id": 1
            }]
        });

        let parsed = parse_bookmarks_export(&archive.to_string()).expect("legacy archive parses");
        assert_eq!(parsed.entries[0].pinyin_numbers, "ai4");
        assert_eq!(parsed.entries[0].hsk, levels_value("爱", "ai4"));
        assert!(parsed.entries[0]
            .hsk
            .hsk_2015
            .contains(&chinese_dictionary::HskLevel::One));
    }
}

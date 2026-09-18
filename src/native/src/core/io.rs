use super::dictionary::{resolve_legacy_lexical_unit, LegacyLexicalUnit};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

const RECOVERY_REPORT_FILE_NAME: &str = "Syng bookmark recovery report.txt";

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
pub enum BookmarksExportVersion {
    V1,
    V2,
    V3,
    V4,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BookmarksExportMeta {
    pub version: BookmarksExportVersion,
    pub name: String,
}

/// Schema-4 list archives deliberately contain no dictionary payload. The installed dictionary
/// remains canonical, and notes are the only user content carried with an identity.
#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct BookmarkEntry {
    pub lexical_id: String,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BookmarksExport {
    pub meta: BookmarksExportMeta,
    pub entries: Vec<BookmarkEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery_report: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LegacyV1BookmarkEntry {
    traditional: String,
    simplified: String,
    #[serde(default)]
    definitions: Vec<String>,
    #[serde(rename = "toneMarks", default)]
    tone_marks: Vec<u8>,
    #[serde(default)]
    notes: String,
}

#[derive(Debug, Deserialize)]
struct LegacyBookmarkEntry {
    traditional: String,
    simplified: String,
    #[serde(default)]
    hash: serde_json::Value,
    #[serde(default)]
    word_id: serde_json::Value,
    #[serde(default)]
    english: Vec<String>,
    #[serde(default)]
    pinyin_marks: String,
    #[serde(default)]
    pinyin_numbers: String,
    #[serde(default)]
    tone_marks: Vec<u8>,
    #[serde(default)]
    measure_words: Vec<serde_json::Value>,
    #[serde(default)]
    hsk: serde_json::Value,
    #[serde(default)]
    notes: String,
}

#[derive(Debug, Deserialize)]
struct LegacyBookmarksExport {
    meta: BookmarksExportMeta,
    entries: Vec<LegacyBookmarkEntry>,
}

fn recovery_record(reason: &str, value: &impl Serialize) -> String {
    let legacy = serde_json::to_string_pretty(value).unwrap_or_else(|_| "{}".to_string());
    format!("{reason}\nLegacy data:\n{legacy}")
}

fn write_report_to_file(
    app: &tauri::AppHandle,
    file_path: FilePath,
    report: &str,
) -> Result<(), String> {
    let mut open_options = OpenOptions::new();
    open_options.write(true).create(true).truncate(true);
    let mut file = app
        .fs()
        .open(file_path, open_options)
        .map_err(|error| format!("Could not open the recovery report file: {error}"))?;
    file.write_all(report.as_bytes())
        .map_err(|error| format!("Could not write the recovery report: {error}"))
}

fn save_recovery_report_with_dialog(app: &tauri::AppHandle, report: &str) -> Result<(), String> {
    let file_path = app
        .dialog()
        .file()
        .set_title("Save Bookmark Recovery Report")
        .add_filter("Text files", &["txt"])
        .set_file_name(RECOVERY_REPORT_FILE_NAME)
        .blocking_save_file();
    let file_path = file_path.ok_or_else(|| {
        "A recovery report must be saved before unresolved bookmarks can be removed.".to_string()
    })?;
    write_report_to_file(app, file_path, report)
}

fn write_recovery_report_to_path(path: &Path, report: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create the recovery report directory: {error}"))?;
    }
    std::fs::write(path, report)
        .map_err(|error| format!("Could not write the recovery report: {error}"))
}

/// Persists recovery details before migration or import removes an unresolved legacy entry.
/// Desktop prefers the user's Desktop and falls back to a Save dialog. Mobile uses app data,
/// while the frontend immediately presents Copy and Save actions for a user-controlled copy.
#[tauri::command(async)]
pub async fn persist_bookmark_recovery_report(
    app: tauri::AppHandle,
    report: String,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Ok(desktop_directory) = app.path().desktop_dir() {
            let desktop_report = desktop_directory.join(RECOVERY_REPORT_FILE_NAME);
            if write_recovery_report_to_path(&desktop_report, &report).is_ok() {
                return Ok(());
            }
        }
        return save_recovery_report_with_dialog(&app, &report);
    }

    #[cfg(mobile)]
    {
        let app_data_directory = app.path().app_data_dir().map_err(|error| {
            format!("Could not locate app data for the recovery report: {error}")
        })?;
        return write_recovery_report_to_path(
            &app_data_directory.join(RECOVERY_REPORT_FILE_NAME),
            &report,
        );
    }

    #[allow(unreachable_code)]
    Err("This platform cannot persist a bookmark recovery report.".to_string())
}

/// Opens a user-selected Save dialog for an already durable recovery report.
#[tauri::command(async)]
pub async fn save_bookmark_recovery_report(
    app: tauri::AppHandle,
    report: String,
) -> Result<(), String> {
    save_recovery_report_with_dialog(&app, &report)
}

fn resolve_legacy_entry(legacy: LegacyBookmarkEntry) -> Result<BookmarkEntry, String> {
    let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
        simplified: legacy.simplified.clone(),
        traditional: legacy.traditional.clone(),
        pinyin_numbers: legacy.pinyin_numbers.clone(),
        tone_marks: legacy.tone_marks.clone(),
        english: legacy.english.clone(),
    });
    match resolution.unit {
        Some(unit) => Ok(BookmarkEntry {
            lexical_id: unit.id.to_string(),
            notes: legacy.notes,
        }),
        None => Err(recovery_record(
            resolution
                .reason
                .as_deref()
                .unwrap_or("Unknown conversion error."),
            &serde_json::json!({
                "traditional": legacy.traditional,
                "simplified": legacy.simplified,
                "hash": legacy.hash,
                "word_id": legacy.word_id,
                "english": legacy.english,
                "pinyin_marks": legacy.pinyin_marks,
                "pinyin_numbers": legacy.pinyin_numbers,
                "tone_marks": legacy.tone_marks,
                "measure_words": legacy.measure_words,
                "hsk": legacy.hsk,
                "notes": legacy.notes,
            }),
        )),
    }
}

fn resolve_v1_entry(legacy: LegacyV1BookmarkEntry) -> Result<BookmarkEntry, String> {
    let resolution = resolve_legacy_lexical_unit(LegacyLexicalUnit {
        simplified: legacy.simplified.clone(),
        traditional: legacy.traditional.clone(),
        pinyin_numbers: String::new(),
        tone_marks: legacy.tone_marks.clone(),
        english: legacy
            .definitions
            .iter()
            .filter(|definition| !definition.contains("CL"))
            .cloned()
            .collect(),
    });
    match resolution.unit {
        Some(unit) => Ok(BookmarkEntry {
            lexical_id: unit.id.to_string(),
            notes: legacy.notes,
        }),
        None => Err(recovery_record(
            resolution
                .reason
                .as_deref()
                .unwrap_or("Unknown conversion error."),
            &serde_json::json!({
                "traditional": legacy.traditional,
                "simplified": legacy.simplified,
                "definitions": legacy.definitions,
                "toneMarks": legacy.tone_marks,
                "notes": legacy.notes,
            }),
        )),
    }
}

fn merge_entries(entries: Vec<BookmarkEntry>) -> Vec<BookmarkEntry> {
    let mut merged = Vec::<BookmarkEntry>::new();
    for entry in entries {
        if let Some(existing) = merged
            .iter_mut()
            .find(|candidate| candidate.lexical_id == entry.lexical_id)
        {
            let note = entry.notes.trim();
            if !note.is_empty() && !existing.notes.split("\n\n---\n\n").any(|part| part == note) {
                if !existing.notes.trim().is_empty() {
                    existing.notes.push_str("\n\n---\n\n");
                }
                existing.notes.push_str(note);
            }
        } else {
            merged.push(entry);
        }
    }
    merged
}

fn parse_legacy_archive(file: &str) -> Result<BookmarksExport, String> {
    let archive: LegacyBookmarksExport =
        serde_json::from_str(file).map_err(|error| error.to_string())?;
    let (resolved, unresolved): (Vec<_>, Vec<_>) = archive
        .entries
        .into_iter()
        .map(resolve_legacy_entry)
        .partition(Result::is_ok);
    let report = unresolved
        .into_iter()
        .filter_map(Result::err)
        .collect::<Vec<_>>();
    Ok(BookmarksExport {
        meta: BookmarksExportMeta { version: BookmarksExportVersion::V4, name: archive.meta.name },
        entries: merge_entries(resolved.into_iter().filter_map(Result::ok).collect()),
        recovery_report: (!report.is_empty()).then(|| format!("Some imported vocabulary could not be recovered. Please re-add these entries manually.\n\n{}", report.join("\n\n==========\n\n"))),
    })
}

fn parse_v1_archive(file: &str) -> Result<BookmarksExport, String> {
    let (resolved, unresolved): (Vec<_>, Vec<_>) = file
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            serde_json::from_str::<LegacyV1BookmarkEntry>(line)
                .map_err(|error| format!("Could not read a V1 entry: {error}"))
                .and_then(resolve_v1_entry)
        })
        .partition(Result::is_ok);
    let report = unresolved
        .into_iter()
        .filter_map(Result::err)
        .collect::<Vec<_>>();
    Ok(BookmarksExport {
        meta: BookmarksExportMeta { version: BookmarksExportVersion::V4, name: "Imported List".to_string() },
        entries: merge_entries(resolved.into_iter().filter_map(Result::ok).collect()),
        recovery_report: (!report.is_empty()).then(|| format!("Some imported vocabulary could not be recovered. Please re-add these entries manually.\n\n{}", report.join("\n\n==========\n\n"))),
    })
}

fn parse_bookmarks_export(file: &str) -> Result<BookmarksExport, String> {
    if let Ok(v4) = serde_json::from_str::<BookmarksExport>(file) {
        if v4.meta.version == BookmarksExportVersion::V4 {
            let (valid, invalid): (Vec<_>, Vec<_>) = v4.entries.into_iter().partition(|entry| {
                chinese_dictionary::query_by_id_str(&entry.lexical_id).is_some()
            });
            let invalid_report = (!invalid.is_empty()).then(|| {
                let records = invalid
                    .iter()
                    .map(|entry| {
                        recovery_record("The lexical ID is no longer in this dictionary.", entry)
                    })
                    .collect::<Vec<_>>()
                    .join("\n\n==========\n\n");
                format!(
                    "Some imported vocabulary could not be recovered. Please re-add these entries manually.\n\n{records}"
                )
            });
            let recovery_report = match (v4.recovery_report, invalid_report) {
                (Some(existing), Some(invalid)) => {
                    Some(format!("{existing}\n\n==========\n\n{invalid}"))
                }
                (Some(existing), None) => Some(existing),
                (None, Some(invalid)) => Some(invalid),
                (None, None) => None,
            };
            return Ok(BookmarksExport {
                meta: v4.meta,
                entries: merge_entries(valid),
                recovery_report,
            });
        }
    }
    parse_legacy_archive(file)
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
        .add_filter("Syng List Formats", &["syli"])
        .set_file_name(format!("{name}.syli"))
        .blocking_save_file();
    if let Some(file_path) = file_path {
        let export = BookmarksExport {
            meta: BookmarksExportMeta {
                name,
                version: BookmarksExportVersion::V4,
            },
            entries: merge_entries(data),
            recovery_report: None,
        };
        let export_data = serde_json::to_string(&export)
            .map_err(|error| format!("Could not prepare data for export: {error}"))?;
        write_report_to_file(&app, file_path, &export_data)
            .map_err(|error| error.replace("recovery report", "export file"))?;
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
    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let content = app
        .fs()
        .read_to_string(file_path.clone())
        .map_err(|error| format!("Failed to read from file: {error}"))?;
    let is_v1 = file_path.to_string().ends_with(".sld");
    let export = if is_v1 {
        parse_v1_archive(&content)
    } else {
        parse_bookmarks_export(&content).or_else(|_| parse_v1_archive(&content))
    }?;
    if let Some(report) = &export.recovery_report {
        persist_bookmark_recovery_report(app.clone(), report.clone()).await?;
    }
    Ok(Some(export))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn v4_export_contains_only_identity_and_notes() {
        let export = BookmarksExport {
            meta: BookmarksExportMeta {
                version: BookmarksExportVersion::V4,
                name: "Test".to_string(),
            },
            entries: vec![BookmarkEntry {
                lexical_id: "1:0000000000000000000000000000000000000000000000000000000000000000"
                    .to_string(),
                notes: "note".to_string(),
            }],
            recovery_report: None,
        };
        assert_eq!(
            serde_json::to_value(export).unwrap()["entries"][0],
            serde_json::json!({ "lexical_id": "1:0000000000000000000000000000000000000000000000000000000000000000", "notes": "note" })
        );
    }
    #[test]
    fn duplicate_notes_are_merged_without_loss() {
        let merged = merge_entries(vec![
            BookmarkEntry {
                lexical_id: "id".to_string(),
                notes: "first".to_string(),
            },
            BookmarkEntry {
                lexical_id: "id".to_string(),
                notes: "second".to_string(),
            },
        ]);
        assert_eq!(merged[0].notes, "first\n\n---\n\nsecond");
    }

    #[test]
    fn v4_import_reports_unknown_ids_without_preserving_them() {
        let archive = serde_json::json!({
            "meta": { "version": "V4", "name": "Imported" },
            "entries": [{
                "lexical_id": "1:0000000000000000000000000000000000000000000000000000000000000000",
                "notes": "Keep this note"
            }]
        });
        let parsed = parse_bookmarks_export(&archive.to_string()).unwrap();
        assert!(parsed.entries.is_empty());
        assert!(parsed
            .recovery_report
            .as_deref()
            .unwrap_or_default()
            .contains("Keep this note"));
    }

    #[test]
    fn v1_archive_uses_exact_matching_without_retaining_legacy_payloads() {
        let archive = serde_json::json!({
            "traditional": "上水",
            "simplified": "上水",
            "definitions": [
                "upper reaches (of a river)",
                "to go upstream",
                "to add some water",
                "to water (a crop etc)"
            ],
            "toneMarks": [4, 3],
            "notes": "Legacy note"
        });
        let parsed = parse_v1_archive(&format!("{archive}\n")).unwrap();
        assert_eq!(parsed.meta.version, BookmarksExportVersion::V4);
        assert_eq!(parsed.entries.len(), 1);
        assert!(parsed.entries[0].lexical_id.starts_with("1:"));
        assert_eq!(parsed.entries[0].notes, "Legacy note");
    }
    #[test]
    fn legacy_archive_resolves_to_versioned_ids() {
        let archive = serde_json::json!({ "meta": { "version": "V3", "name": "Legacy" }, "entries": [{ "traditional": "愛", "simplified": "爱", "english": ["to love"], "pinyin_numbers": "ai4", "tone_marks": [4], "notes": "" }] });
        let parsed = parse_bookmarks_export(&archive.to_string()).unwrap();
        assert_eq!(parsed.meta.version, BookmarksExportVersion::V4);
        assert!(parsed.entries[0].lexical_id.starts_with("1:"));
    }
}

//! Native helpers for the file-based app-data migration bridge.
//!
//! The JavaScript filesystem plugin is scoped to the current app identifier, but
//! the identifier migration needs to read `syng-migration-data.json` from the
//! previous `org.syng.app` app-data directory. This module resolves that legacy
//! sibling directory and exposes a Tauri command that returns the file contents
//! when the file exists.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Bundle identifier used by beta builds before the package identifier change.
pub const LEGACY_IDENTIFIER: &str = "org.syng.app";
const MIGRATION_FILE_NAME: &str = "syng-migration-data.json";

/// Resolve the app-data directory for another identifier based on the current app-data path.
///
/// Tauri resolves the current platform-specific base directory for us. For the
/// legacy identifier, the old directory is expected to live beside the current
/// identifier directory under the same app-data parent.
pub(crate) fn app_data_dir_for_identifier_from_current(
    current_app_data_dir: &Path,
    current_identifier: &str,
    target_identifier: &str,
) -> Result<PathBuf, String> {
    if current_identifier == target_identifier {
        return Ok(current_app_data_dir.to_path_buf());
    }

    // App-data paths are keyed by identifier, so changing identifiers swaps only
    // the final path component while keeping the same platform-specific parent.
    current_app_data_dir
        .parent()
        .map(|parent| parent.join(target_identifier))
        .ok_or_else(|| "Could not resolve app data directory parent".to_string())
}

/// Resolve an app-data directory for the provided identifier using Tauri's current path API.
pub(crate) fn app_data_dir_for_identifier(
    app: &AppHandle,
    target_identifier: &str,
) -> Result<PathBuf, String> {
    let current_app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;

    app_data_dir_for_identifier_from_current(
        &current_app_data_dir,
        &app.config().identifier,
        target_identifier,
    )
}

/// Resolve the legacy beta app-data directory.
pub(crate) fn legacy_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app_data_dir_for_identifier(app, LEGACY_IDENTIFIER)
}

/// Read a text file when present, treating a missing file as `Ok(None)`.
pub(crate) fn read_optional_text_file(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read {}: {error}", path.display())),
    }
}

/// Read the legacy identifier's migration JSON file for the JavaScript migration manager.
#[tauri::command]
pub fn read_legacy_migration_file(app: AppHandle) -> Result<Option<String>, String> {
    let file_path = legacy_app_data_dir(&app)?.join(MIGRATION_FILE_NAME);
    read_optional_text_file(&file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolves_sibling_identifier_dir() {
        let current = PathBuf::from("/tmp/AppData/xyz.bytecraft.syng");

        let resolved = app_data_dir_for_identifier_from_current(
            &current,
            "xyz.bytecraft.syng",
            LEGACY_IDENTIFIER,
        )
        .unwrap();

        assert_eq!(resolved, PathBuf::from("/tmp/AppData/org.syng.app"));
    }

    #[test]
    fn keeps_current_dir_when_identifier_matches() {
        let current = PathBuf::from("/tmp/AppData/org.syng.app");

        let resolved = app_data_dir_for_identifier_from_current(
            &current,
            LEGACY_IDENTIFIER,
            LEGACY_IDENTIFIER,
        )
        .unwrap();

        assert_eq!(resolved, current);
    }

    #[test]
    fn read_optional_text_file_returns_none_for_missing_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("missing.json");

        assert_eq!(read_optional_text_file(&file_path).unwrap(), None);
    }

    #[test]
    fn read_optional_text_file_returns_content_for_existing_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("migration.json");
        fs::write(&file_path, "{\"ok\":true}").unwrap();

        assert_eq!(
            read_optional_text_file(&file_path).unwrap(),
            Some("{\"ok\":true}".to_string())
        );
    }
}

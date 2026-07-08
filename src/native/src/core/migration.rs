use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const LEGACY_IDENTIFIER: &str = "org.syng.app";
const MIGRATION_FILE_NAME: &str = "syng-migration-data.json";

pub(crate) fn app_data_dir_for_identifier_from_current(
    current_app_data_dir: &Path,
    current_identifier: &str,
    target_identifier: &str,
) -> Result<PathBuf, String> {
    if current_identifier == target_identifier {
        return Ok(current_app_data_dir.to_path_buf());
    }

    current_app_data_dir
        .parent()
        .map(|parent| parent.join(target_identifier))
        .ok_or_else(|| "Could not resolve app data directory parent".to_string())
}

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

pub(crate) fn legacy_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app_data_dir_for_identifier(app, LEGACY_IDENTIFIER)
}

pub(crate) fn read_optional_text_file(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read {}: {error}", path.display())),
    }
}

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

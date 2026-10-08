//! Keep AppImage's bundled WebKit storage separate from the system WebKit profile.

use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::Path;
use tauri::utils::config::{AppDirectoriesOverride, Config};
use tauri::Manager;

const PROFILE_SEED_MARKER: &str = "appimage-profile-initialized";
const SEED_FILES: &[&str] = &["syng-migration-data.json", "telemetry_prefs.json"];

/// Runs before Tauri creates any webviews or resolves plugin filesystem scopes.
/// APPDIR also covers extracted AppImages launched through their AppRun script.
pub fn configure_appimage_storage(
    config: &mut Config,
    appimage: Option<&OsStr>,
    appdir: Option<&OsStr>,
) -> bool {
    let is_appimage = [appimage, appdir]
        .into_iter()
        .flatten()
        .any(|value| !value.is_empty());
    if !is_appimage || config.app.app_directories_override.is_some() {
        return false;
    }

    config.app.app_directories_override = Some(AppDirectoriesOverride::Root(
        format!("$LOCALDATA/{}.appimage", config.identifier).into(),
    ));
    true
}

pub fn uses_appimage_storage(config: &Config) -> bool {
    config.app.app_directories_override
        == Some(AppDirectoriesOverride::Root(
            format!("$LOCALDATA/{}.appimage", config.identifier).into(),
        ))
}

/// Copy portable JSON only. IndexedDB files and the old migration completion
/// marker must stay behind: copying either would break the fresh profile.
fn seed_appimage_profile(profile: &Path, identifier: &str) -> io::Result<()> {
    let marker = profile.join(PROFILE_SEED_MARKER);
    if marker.exists() {
        return Ok(());
    }
    let source = profile
        .parent()
        .ok_or_else(|| io::Error::other("AppImage profile has no parent directory"))?
        .join(identifier);
    fs::create_dir_all(profile)?;

    for file_name in SEED_FILES {
        let destination = profile.join(file_name);
        if destination.exists() {
            continue;
        }
        let contents = match fs::read(source.join(file_name)) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error),
        };
        // Finish the copy before exposing it as a restore candidate. A failed or
        // interrupted write can be retried without importing a partial backup.
        let temporary = profile.join(format!("{file_name}.seed"));
        fs::write(&temporary, contents)?;
        fs::rename(temporary, destination)?;
    }
    fs::write(marker, b"1\n")
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn storage_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("appimage-storage")
        .setup(|app, _api| {
            // Plugin initialization precedes window creation. In particular,
            // preserve telemetry opt-outs before telemetry_init can run.
            seed_appimage_profile(&app.path().app_data_dir()?, &app.config().identifier)?;
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn config() -> Config {
        serde_json::from_value(serde_json::json!({ "identifier": "xyz.bytecraft.syng" })).unwrap()
    }

    #[test]
    fn installed_packages_keep_the_existing_profile() {
        let mut config = config();
        assert!(!configure_appimage_storage(&mut config, None, None));
        assert!(!configure_appimage_storage(
            &mut config,
            Some(OsStr::new("")),
            None
        ));
        assert!(config.app.app_directories_override.is_none());
    }

    #[test]
    fn mounted_and_extracted_appimages_use_a_stable_writable_profile() {
        for (appimage, appdir) in [
            (Some(OsStr::new("/downloads/Syng.AppImage")), None),
            (None, Some(OsStr::new("/downloads/squashfs-root"))),
        ] {
            let mut config = config();
            assert!(configure_appimage_storage(&mut config, appimage, appdir));
            assert!(uses_appimage_storage(&config));
            assert_eq!(
                config.app.app_directories_override,
                Some(AppDirectoriesOverride::Root(
                    "$LOCALDATA/xyz.bytecraft.syng.appimage".into()
                ))
            );
            assert_eq!(config.identifier, "xyz.bytecraft.syng");
        }
    }

    #[test]
    fn explicit_storage_overrides_are_preserved() {
        let mut config = config();
        let storage = Some(AppDirectoriesOverride::Root(
            "$LOCALDATA/custom-profile".into(),
        ));
        config.app.app_directories_override = storage.clone();
        assert!(!configure_appimage_storage(
            &mut config,
            Some(OsStr::new("Syng.AppImage")),
            None
        ));
        assert_eq!(config.app.app_directories_override, storage);
    }

    #[test]
    fn seeds_json_once_without_copying_browser_databases_or_completion_marker() {
        let directory = tempdir().unwrap();
        let source = directory.path().join("xyz.bytecraft.syng");
        let profile = directory.path().join("xyz.bytecraft.syng.appimage");
        fs::create_dir_all(source.join("databases")).unwrap();
        fs::write(source.join("databases/IndexedDB.sqlite3"), b"old database").unwrap();
        fs::write(source.join("syng-migration-complete.json"), b"{}").unwrap();
        fs::write(source.join(SEED_FILES[0]), b"{\"databases\":{}}").unwrap();
        fs::write(source.join(SEED_FILES[1]), b"{\"enabled\":false}").unwrap();

        seed_appimage_profile(&profile, "xyz.bytecraft.syng").unwrap();
        assert_eq!(
            fs::read(profile.join(SEED_FILES[0])).unwrap(),
            b"{\"databases\":{}}"
        );
        assert_eq!(
            fs::read(profile.join(SEED_FILES[1])).unwrap(),
            b"{\"enabled\":false}"
        );
        assert!(!profile.join("databases").exists());
        assert!(!profile.join("syng-migration-complete.json").exists());
        assert_eq!(
            fs::read(source.join("databases/IndexedDB.sqlite3")).unwrap(),
            b"old database"
        );

        fs::write(profile.join(SEED_FILES[0]), b"AppImage's newer backup").unwrap();
        fs::write(source.join(SEED_FILES[0]), b"RPM's newer backup").unwrap();
        seed_appimage_profile(&profile, "xyz.bytecraft.syng").unwrap();
        assert_eq!(
            fs::read(profile.join(SEED_FILES[0])).unwrap(),
            b"AppImage's newer backup"
        );
        assert_eq!(
            fs::read(source.join(SEED_FILES[0])).unwrap(),
            b"RPM's newer backup"
        );
    }

    #[test]
    fn first_install_and_existing_appimage_files_are_supported() {
        let directory = tempdir().unwrap();
        let profile = directory.path().join("xyz.bytecraft.syng.appimage");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join(SEED_FILES[1]), b"own preferences").unwrap();
        seed_appimage_profile(&profile, "xyz.bytecraft.syng").unwrap();
        assert!(profile.join(PROFILE_SEED_MARKER).exists());
        assert!(!profile.join(SEED_FILES[0]).exists());
        assert_eq!(
            fs::read(profile.join(SEED_FILES[1])).unwrap(),
            b"own preferences"
        );
    }

    #[test]
    fn seeding_does_not_replace_existing_appimage_preferences() {
        let directory = tempdir().unwrap();
        let source = directory.path().join("xyz.bytecraft.syng");
        let profile = directory.path().join("xyz.bytecraft.syng.appimage");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&profile).unwrap();
        fs::write(source.join(SEED_FILES[1]), b"{\"enabled\":true}").unwrap();
        fs::write(profile.join(SEED_FILES[1]), b"{\"enabled\":false}").unwrap();
        seed_appimage_profile(&profile, "xyz.bytecraft.syng").unwrap();
        assert_eq!(
            fs::read(profile.join(SEED_FILES[1])).unwrap(),
            b"{\"enabled\":false}"
        );
    }
}

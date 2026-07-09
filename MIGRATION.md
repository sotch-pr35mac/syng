# Syng Data Migration Guide

This document describes Syng's file-based migration bridge for preserving user
data across storage identity changes. It covers both the original Tauri 1 to
Tauri 2 storage migration and the current bundle identifier move from
`org.syng.app` to `xyz.bytecraft.syng`.

## Background

Syng stores preferences, word lists, and bookmarks in PouchDB/IndexedDB. During
the Tauri 1 to Tauri 2 upgrade, WebView storage paths could change, making the
old IndexedDB data inaccessible. Changing the bundle identifier can also hide
data because app-data directories are keyed by identifier.

The current identifier is:

```json
{
	"identifier": "xyz.bytecraft.syng"
}
```

The legacy beta identifier was `org.syng.app`.

## Solution Overview

The app writes a JSON backup named `syng-migration-data.json` in the app data
directory. That file is outside WebView IndexedDB and can be read after Tauri
storage changes.

Known app-data backup locations:

- Current macOS: `~/Library/Application Support/xyz.bytecraft.syng/syng-migration-data.json`
- Legacy macOS: `~/Library/Application Support/org.syng.app/syng-migration-data.json`
- Current Windows: `%APPDATA%\xyz.bytecraft.syng\syng-migration-data.json`
- Legacy Windows: `%APPDATA%\org.syng.app\syng-migration-data.json`
- Current Linux: `~/.local/share/xyz.bytecraft.syng/syng-migration-data.json`
- Legacy Linux: `~/.local/share/org.syng.app/syng-migration-data.json`

On startup, the app:

1. Initializes preference and bookmark managers.
2. Checks whether the current bookmarks database is empty.
3. Checks whether `syng-migration-complete.json` exists in the current app-data directory.
4. If current user data is empty and migration is not complete, tries the legacy `org.syng.app` migration file first, then the current file.
5. Imports data and writes `syng-migration-complete.json` so prefs-only migrations do not repeat forever.
6. Exports a fresh current-identifier backup after startup.

The updater also exports a fresh migration backup before `downloadAndInstall()`.
If that backup fails, the update install is rejected.

## Migration File Format

Version 1 was the original Tauri 1 to Tauri 2 bridge. Version 2 adds identifier
metadata for the package identifier migration. Both versions contain the same
user data categories:

```json
{
	"version": 2,
	"exportedAt": "2026-01-01T00:00:00.000Z",
	"identifiers": {
		"current": "xyz.bytecraft.syng",
		"legacy": "org.syng.app"
	},
	"databases": {
		"config": [{ "_id": "config", "_rev": "...", "toneColors": {} }],
		"wordLists": [{ "_id": "abc123", "_rev": "...", "name": "Bookmarks" }],
		"bookmarks": [{ "_id": "...", "_rev": "...", "simplified": "你好" }]
	}
}
```

Version 1 files are still accepted. They contain `config`, `wordLists`, and
`bookmarks` without the `identifiers` field.

## Tauri 2 Notes

The bridge was originally added for the Tauri 1 to Tauri 2 transition. The
current implementation uses Tauri 2 APIs:

| Tauri 1 API                         | Tauri 2 implementation                                  |
| ----------------------------------- | ------------------------------------------------------- |
| `window.__TAURI__.path.appDataDir()` | `import { appDataDir } from '@tauri-apps/api/path'`     |
| `window.__TAURI__.fs.readTextFile()` | `import { readTextFile } from '@tauri-apps/plugin-fs'`  |
| `window.__TAURI__.fs.writeTextFile()` | `import { writeTextFile } from '@tauri-apps/plugin-fs'` |
| `window.__TAURI__.fs.createDir()`   | `import { mkdir } from '@tauri-apps/plugin-fs'`         |
| `window.__TAURI__.window...`        | `import { getCurrentWebviewWindow } ...`                |

Filesystem calls use `BaseDirectory.AppData` so Tauri handles platform-specific
paths and fs-scope permissions.

## Files Involved

| File                                            | Purpose                                                   |
| ----------------------------------------------- | --------------------------------------------------------- |
| `src/views/templates/utils/migrationManager.js` | Export/import logic, legacy file selection, shutdown hook |
| `src/views/templates/utils/startup.js`          | Runs migration during startup                             |
| `src/views/templates/utils/updateManager.ts`    | Exports backup before updater install                     |
| `src/native/src/core/migration.rs`              | Reads legacy app-data migration file                      |

## What Is Migrated

- Preferences and settings
- Word lists
- Bookmarked words and notes

Reader documents and telemetry state are not migrated by this bridge because the
source beta builds this identifier migration targets did not ship those stores.

Old app-data directories are left in place. The app reads what it needs from
`org.syng.app` and writes current backups under `xyz.bytecraft.syng`.

## Testing

Run automated coverage:

```bash
npm test -- migrationManager updateManager
cd src/native && cargo test migration
```

Manual upgrade check:

1. Run an `org.syng.app` beta that exports `syng-migration-data.json`.
2. Confirm the legacy file exists:

    ```bash
    cat ~/Library/Application\ Support/org.syng.app/syng-migration-data.json
    ```

3. Install/run the `xyz.bytecraft.syng` build.
4. Confirm bookmarks, lists, and preferences are restored.
5. Confirm a completion marker exists:

    ```bash
    cat ~/Library/Application\ Support/xyz.bytecraft.syng/syng-migration-complete.json
    ```

6. Relaunch and confirm migration does not replay.

Fresh install check:

1. Remove both current and legacy migration files in a test account/profile.
2. Launch the app.
3. Confirm it starts with default state and no migration errors.

Existing data safety check:

1. Put bookmark data in the current `xyz.bytecraft.syng` app.
2. Leave a legacy migration file in `org.syng.app`.
3. Relaunch.
4. Confirm current data is not overwritten.

## Troubleshooting

### Migration File Not Created

- Check console logs for errors during startup, shutdown, or update install.
- Verify the app has write permissions to the app-data directory.
- Try closing the app cleanly rather than force-quitting.

### Migration Not Triggered After Upgrade

- Verify the migration file exists in the expected legacy or current location.
- Confirm the current bookmarks database is empty in the test profile.
- Confirm `syng-migration-complete.json` is not already present.
- Check console logs for native legacy-file read errors.

### Data Partially Restored

- Check console logs for individual document import errors.
- The migration continues if one document fails.
- Manually check the migration file JSON for corruption.

## Known Limits

This bridge relies on the JSON backup file. A dormant beta user who never ran a
build that exported `syng-migration-data.json` may not have data available for
automatic restore. The static Tauri updater endpoint can also allow version
skips, so keep legacy migration reading in place for several releases.

## Removing The Bridge

Do not remove the legacy file reader until you are comfortable dropping direct
beta migration support. The ongoing backup export is low overhead and useful
even after the identifier migration window closes.

## Version History

| Version | Date | Changes                                                                  |
| ------- | ---- | ------------------------------------------------------------------------ |
| 1       | 2024 | Initial Tauri 1 to Tauri 2 file bridge                                   |
| 2       | 2026 | Identifier bridge from `org.syng.app` to `xyz.bytecraft.syng`             |

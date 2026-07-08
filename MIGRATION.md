# Syng Data Migration Guide

This document describes Syng's file-based migration bridge for storage identity
changes. It currently covers the identifier move from `org.syng.app` to
`xyz.bytecraft.syng`, and still supports the earlier Tauri 1 to Tauri 2 storage
bridge.

## Background

Syng stores user data in PouchDB/IndexedDB. Tauri and the host OS key that
storage by application identity, so changing the bundle identifier can make the
old WebView data inaccessible to the renamed app.

The current identifier is:

```json
{
	"identifier": "xyz.bytecraft.syng"
}
```

The legacy beta identifier was `org.syng.app`.

## Solution Overview

The app keeps a JSON backup in the app data directory:

- Current macOS: `~/Library/Application Support/xyz.bytecraft.syng/syng-migration-data.json`
- Legacy macOS: `~/Library/Application Support/org.syng.app/syng-migration-data.json`
- Current Windows: `%APPDATA%\xyz.bytecraft.syng\syng-migration-data.json`
- Legacy Windows: `%APPDATA%\org.syng.app\syng-migration-data.json`
- Current Linux: `~/.local/share/xyz.bytecraft.syng/syng-migration-data.json`
- Legacy Linux: `~/.local/share/org.syng.app/syng-migration-data.json`

On startup, the app:

1. Initializes preferences, bookmarks, and reader document managers.
2. Checks whether current user data stores are empty.
3. Checks whether the migration completion marker exists in the current app data directory.
4. If current stores are empty and migration has not completed, tries the legacy `org.syng.app` migration file first, then the current file.
5. Imports data and writes `syng-migration-complete.json` so prefs-only migrations do not repeat forever.
6. Exports a fresh current-identifier backup after startup.

The updater also exports a fresh migration backup before `downloadAndInstall()`.
If that backup fails, the update install is rejected.

## Migration File Format

Version 2 includes preferences, word lists, bookmarks, reader documents, and
reader attachments:

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
		"bookmarks": [{ "_id": "...", "_rev": "...", "simplified": "你好" }],
		"readerDocuments": [
			{
				"doc": { "_id": "reader:1", "_rev": "...", "title": "Reader Doc" },
				"attachments": [
					{
						"name": "source",
						"contentType": "application/pdf",
						"data": "base64..."
					}
				]
			}
		]
	}
}
```

Version 1 files are still accepted. They contain only `config`, `wordLists`, and
`bookmarks`; missing `readerDocuments` is treated as an empty list.

## Files Involved

| File                                            | Purpose                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `src/views/templates/utils/migrationManager.js` | Export/import logic, legacy file selection, shutdown hook              |
| `src/views/templates/utils/startup.js`          | Runs migration during startup                                          |
| `src/views/templates/utils/updateManager.ts`    | Exports backup before updater install                                  |
| `src/native/src/core/migration.rs`              | Reads legacy app-data migration file                                   |
| `src/native/src/core/telemetry.rs`              | Copies legacy telemetry identity/state into the new app-data directory |

## What Is Migrated

- Preferences and settings
- Word lists
- Bookmarked words and notes
- Reader documents
- Reader source attachments, source HTML, and imported image assets
- Native telemetry device ID, prefs, installation token, and pending SQLite queue files

Old app data directories are left in place. The app copies what it needs into
the new identifier and does not delete `org.syng.app`.

## Testing

Run automated coverage:

```bash
npm test -- migrationManager updateManager
cd src/native && cargo test migration
cd src/native && cargo test telemetry
```

Manual upgrade check:

1. Run an `org.syng.app` beta that exports `syng-migration-data.json`.
2. Confirm the legacy file exists:

    ```bash
    cat ~/Library/Application\ Support/org.syng.app/syng-migration-data.json
    ```

3. Install/run the `xyz.bytecraft.syng` build.
4. Confirm bookmarks, lists, preferences, and reader documents are restored.
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

1. Put data in the current `xyz.bytecraft.syng` app.
2. Leave a legacy migration file in `org.syng.app`.
3. Relaunch.
4. Confirm current data is not overwritten.

## Known Limits

This bridge relies on the JSON backup file. A dormant beta user who never ran a
build that exported `syng-migration-data.json` may not have data available for
automatic restore. The static Tauri updater endpoint can also allow version
skips, so keep legacy migration reading in place for several releases.

## Removing The Bridge

Do not remove the legacy reader until you are comfortable dropping direct beta
migration support. The ongoing backup export is low overhead and useful even
after the identifier migration window closes.

## Version History

| Version | Date | Changes                                                                                    |
| ------- | ---- | ------------------------------------------------------------------------------------------ |
| 1       | 2024 | Initial Tauri 1 to Tauri 2 file bridge                                                     |
| 2       | 2026 | Identifier bridge from `org.syng.app` to `xyz.bytecraft.syng`; reader docs and attachments |

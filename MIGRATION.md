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

### Linux AppImage profiles

AppImage bundles WebKitGTK, while RPM/DEB uses the system version. These versions
can have incompatible IndexedDB formats. AppImage therefore uses its own persistent
profile at `~/.local/share/xyz.bytecraft.syng.appimage` (or under `XDG_DATA_HOME`
when set). RPM/DEB keeps `xyz.bytecraft.syng`. The application identifier is unchanged.
Extracted AppImages launched through `AppRun` use the same AppImage profile.

Before creating any windows, the first AppImage launch copies an available
`syng-migration-data.json` and `telemetry_prefs.json` from the old shared profile.
It never copies IndexedDB files or the old migration completion marker. The copied
current backup takes priority over an older beta backup. The normal JSON import
then restores preferences, word lists and bookmarks once. Subsequent changes and
backups stay separate; the two package formats do not synchronize their libraries.

The original profile remains untouched. Reader documents and attachments are not
part of this JSON backup and remain accessible through the original RPM/DEB profile;
they must be reimported to use them in the AppImage. If no backup exists, AppImage
opens first-run setup. Explicit app-directory overrides are respected.

On startup, the app:

1. Initializes preference and bookmark managers.
2. Checks whether the current bookmarks database is empty.
3. Checks whether `syng-migration-complete.json` exists in the current app-data directory.
4. If current user data is empty and migration is not complete, tries the legacy `org.syng.app` migration file first, then the current file.
5. Imports data and writes `syng-migration-complete.json` so prefs-only migrations do not repeat forever.
6. Exports a fresh current-identifier backup after startup.

The updater also exports a fresh migration backup before `downloadAndInstall()`.
If that backup fails, the update install is rejected.

## 2.5.2 Updater Bridge

The updater service selects its response using the installed app version:

- Below 2.5.2, clients keep the legacy dynamic response and compatibility archives.
  Once the bridge is published and promoted, these clients are pinned to 2.5.2.
- At or above 2.5.2, clients receive package-specific manifest entries, including
  DEB, RPM, and AppImage on Linux and MSI/NSIS on Windows. Tauri uses the package
  marker embedded by the bundler. Unknown or missing package entries never fall
  back to another format.

Pre-2.5.2 Linux requests do not identify their installed package type, so their
legacy AppImage selection is intentionally unchanged. **DEB and RPM users must
manually install the matching 2.5.2 package** once that release is published. Close
Syng normally, install the package for the existing format and architecture using
the system package installer, and reopen Syng. Keep the existing app-data directory;
changing to AppImage would select its separate profile described above. Subsequent
updates from 2.5.2 use the installed package format.

The default build creates Tauri 2 artifacts. The desktop release workflow applies
`createUpdaterArtifacts: "v1Compatible"` specifically to 2.5.2, producing native
packages and legacy archives in the same build with the same updater signing key.
Both sets must remain available while the legacy bridge is supported. Later
releases use native artifacts; the server's legacy catalog stays pinned to 2.5.2.
The old beta static manifest, migration-file readers, backup-before-update step,
and mobile/Mac App Store updater exclusions are unchanged.

Before uploading a release, the workflow runs:

```sh
node --test scripts/check-updater-artifacts.test.ts
node scripts/check-updater-artifacts.ts TARGET src/native/target/TARGET/release/bundle
```

The validator requires every expected package and its own signature, rejects a
signature key ID that differs from the configured public key, and compares legacy
archive payloads with the native AppImage/MSI/NSIS bytes. It checks signature
encoding/key IDs, **not cryptographic signature validity**. Real packaged install
and update tests must still verify signature acceptance/rejection, bundle markers,
data preservation, privilege cancellation, and restart before service promotion.
A missing bundle marker blocks promotion; it is not resolved by a generic fallback.

Syrver's modern catalog remains empty (`204 No Content`) until actual signed
artifacts pass these gates. Its existing 2.5.0 legacy metadata is retained meanwhile.
Building 2.5.2 does not publish or promote it automatically. The coordinated
Syrver README describes the separate catalog promotion and deployment procedure.

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

## Identifier Directory Access

The legacy `org.syng.app` backup read is intended for direct-distributed,
unsandboxed desktop builds. Those builds can read user-owned files in sibling
app-data directories for the same OS account, so native Rust code can bridge
from the old identifier directory even though the JavaScript filesystem plugin
is scoped to the current identifier.

Do not rely on this cross-identifier read for sandboxed store builds. A
sandboxed Mac App Store build, for example, should be expected to read only its
own container unless access is granted through a specific entitlement or
user-mediated file selection.

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

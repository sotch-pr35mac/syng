# Syng Data Migration Guide

This document describes the data migration system implemented to preserve user data when upgrading from Tauri 1 to Tauri 2.

## Background

When upgrading from Tauri 1 to Tauri 2, the WebView's data directory path changes. This means that data stored in IndexedDB (where PouchDB stores its data) becomes inaccessible after the upgrade. Users would lose their:

- **Preferences** (tone colors, transparency settings, beta opt-in)
- **Word Lists** (custom vocabulary lists they've created)
- **Bookmarks** (saved words with notes)

## Solution Overview

A file-based migration bridge that:

1. **Exports** all PouchDB data to a JSON file in the app data directory
2. **Imports** from that file when the app detects empty databases after an upgrade

The app data directory (`~/Library/Application Support/org.syng.app/` on macOS) is keyed by the bundle identifier and persists across Tauri major version upgrades.

## How It Works

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APP STARTUP                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Initialize PreferenceManager & BookmarkManager (creates default data)    │
│ 2. Migration Check:                                                         │
│    ├─ Is bookmarks database empty? (no user data)                          │
│    └─ Does migration file exist?                                           │
│        ├─ BOTH TRUE  → Import migration data, refresh managers             │
│        └─ OTHERWISE  → Continue normally (existing install or fresh start) │
│ 3. Setup shutdown hook for future backups                                   │
│ 4. Export backup (safety net in case of crash before clean shutdown)       │
│ 5. Dispatch 'init' event, app ready                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           APP SHUTDOWN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Intercept 'tauri://close-requested' event                               │
│ 2. Export all PouchDB data to migration file (freshest data)               │
│ 3. Close the window                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Migration File Format

The migration file (`syng-migration-data.json`) is stored in the app data directory:

- **macOS**: `~/Library/Application Support/org.syng.app/syng-migration-data.json`
- **Windows**: `%APPDATA%\org.syng.app\syng-migration-data.json`
- **Linux**: `~/.config/org.syng.app/syng-migration-data.json`

Structure:

```json
{
  "version": 1,
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "databases": {
    "config": [
      { "_id": "config", "_rev": "...", "transparency": {...}, "toneColors": {...} }
    ],
    "wordLists": [
      { "_id": "abc123", "_rev": "...", "name": "Bookmarks" },
      { "_id": "def456", "_rev": "...", "name": "HSK 1" }
    ],
    "bookmarks": [
      { "_id": "...", "_rev": "...", "hash": 12345, "simplified": "你好", ... }
    ]
  }
}
```

## Files Involved

| File | Purpose |
|------|---------|
| `src/views/templates/utils/migrationManager.js` | Core migration logic (export, import, hooks) |
| `src/views/templates/utils/startup.js` | Integrates migration into app startup |

## Tauri 2 Upgrade Status

✅ **The migration code has been updated for Tauri 2!** The following changes have been implemented:

### 1. Bundle Identifier Remains the Same

The app data directory is determined by the bundle identifier. The `tauri.conf.json` maintains:

```json
{
  "identifier": "org.syng.app"
}
```

### 2. Tauri 2 API Migration Completed

The migration code has been updated from Tauri 1 to Tauri 2 APIs:

| Tauri 1 API | Tauri 2 Implementation | Status |
|-------------|------------------------|--------|
| `window.__TAURI__.path.appDataDir()` | `import { appDataDir } from '@tauri-apps/api/path'` | ✅ Updated |
| `window.__TAURI__.fs.readTextFile()` | `import { readTextFile } from '@tauri-apps/plugin-fs'` | ✅ Updated |
| `window.__TAURI__.fs.writeTextFile()` | `import { writeTextFile } from '@tauri-apps/plugin-fs'` | ✅ Updated |
| `window.__TAURI__.fs.createDir()` | `import { mkdir } from '@tauri-apps/plugin-fs'` | ✅ Updated |
| `window.__TAURI__.event.listen()` | `import { listen } from '@tauri-apps/api/event'` | ✅ Updated |
| `window.__TAURI__.window.appWindow.close()` | `import { getCurrentWindow } from '@tauri-apps/api/window'` | ✅ Updated |

**Additional Changes for Tauri 2:**

1. ✅ Updated `migrationManager.js` to use ES module imports instead of `window.__TAURI__`
2. ✅ Changed `dir` option to `baseDir` for filesystem operations
3. ✅ Added `fs:allow-appdata-read-recursive` and `fs:allow-appdata-write-recursive` permissions to `capabilities/migrated.json`

### 3. PouchDB Continues to Work

PouchDB should continue working in Tauri 2's WebView. If there are issues, ensure:
- The PouchDB script is still loaded in `index.html`
- IndexedDB is available in the WebView

### 4. First Launch Detection

The migration triggers when:
- Bookmarks database is empty (no user-saved words)
- Migration file exists

This means:
- Fresh installs won't trigger migration (no migration file)
- Existing Tauri 2 installs with data won't be overwritten (database not empty)
- Upgrades from Tauri 1 will trigger migration (empty DB + file exists)

## Testing the Migration

### Prerequisites

- A working build of the current Tauri 1 version
- Some test data (bookmarks, custom lists, preferences)

### Test Procedure

#### Step 1: Verify Export Works

1. Launch the app
2. Add some test data:
   - Create a custom word list (e.g., "Test List")
   - Add several words to bookmarks
   - Add notes to a bookmarked word
   - Change tone color settings
3. **Close the app cleanly** (not force-quit)
4. Check that the migration file was created:

   ```bash
   # macOS
   cat ~/Library/Application\ Support/org.syng.app/syng-migration-data.json

   # Linux
   cat ~/.config/org.syng.app/syng-migration-data.json

   # Windows (PowerShell)
   Get-Content "$env:APPDATA\org.syng.app\syng-migration-data.json"
   ```

5. Verify the JSON contains your test data

#### Step 2: Verify Startup Backup Works

1. Launch the app
2. Immediately check the migration file's timestamp - it should be updated
3. This confirms the startup safety backup is working

#### Step 3: Simulate the Upgrade Scenario

Since you don't have Tauri 2 ready yet, you can simulate the "empty database" scenario:

1. **Close the app**
2. **Delete the IndexedDB data** (simulates what happens after Tauri upgrade):

   ```bash
   # macOS - delete WebKit storage for the app
   rm -rf ~/Library/WebKit/org.syng.app

   # Alternative: Clear via browser dev tools if accessible
   ```

3. **Keep the migration file** (don't delete it)
4. **Launch the app**
5. **Verify your data was restored**:
   - Custom word lists should appear
   - Bookmarked words should be present
   - Notes on words should be intact
   - Tone color settings should be restored

#### Step 4: Verify Fresh Install Behavior

1. Delete both the IndexedDB data AND the migration file
2. Launch the app
3. Verify it starts with default/empty state (no errors)

#### Step 5: Verify Existing Data Not Overwritten

1. With data in the app, create a migration file (close app cleanly)
2. Add MORE data to the app
3. Close and relaunch
4. Verify the new data persists and wasn't overwritten by the migration file

### Console Logging

The migration system logs its activity. Open DevTools (if available) to see:

```
Migration check: database empty = false, migration file exists = true
```

or

```
Migration check: database empty = true, migration file exists = true
Performing migration from backup file...
Importing migration data (version 1) from 2024-01-15T10:30:00.000Z
Migration data imported successfully
Migration completed, reinitializing styles...
```

## Troubleshooting

### Migration File Not Created

- Check console for errors during shutdown
- Verify the app has write permissions to the app data directory
- Try closing the app cleanly (not force-quit)

### Migration Not Triggered After Upgrade

- Verify the migration file exists in the correct location
- Check that the bundle identifier matches
- Look for console errors during startup

### Data Partially Restored

- Check console for individual document import errors
- The migration continues even if some documents fail
- Manually check the migration file JSON for corruption

## Removing the Migration System

Once you've confirmed all users have successfully migrated to Tauri 2, you can optionally remove this system:

1. Delete `src/views/templates/utils/migrationManager.js`
2. Remove migration imports and calls from `startup.js`
3. Optionally delete migration files from users' systems (or leave them - they're harmless)

However, keeping it has minimal overhead and provides an ongoing backup mechanism.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1 | 2024 | Initial migration system for Tauri 1 → 2 upgrade |


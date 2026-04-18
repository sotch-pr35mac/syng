//! Telemetry pipeline for Syng.
//!
//! Events are bucketed into one of three families — Event, ScreenView, or Error —
//! and written to a local SQLite queue (`telemetry_queue.db` in the app-data dir).
//! A background flush will batch-send queued rows to the analytics backend; until
//! then rows accumulate locally and can be inspected in the Telemetry Settings panel.
//!
//! # Flow
//! 1. JS calls a `telemetry_*` Tauri command.
//! 2. The command locks `TelemetryManager` and calls `emit_event`.
//! 3. `emit_event` checks per-family opt-out prefs, then delegates to `insert_event`.
//! 4. `insert_event` wraps the payload in a JSON envelope and INSERTs it into SQLite.
//! 5. After each insert the oldest rows beyond `MAX_QUEUE_SIZE` are pruned.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

/// Total number of events retained in the local queue before oldest rows are dropped.
/// This cap covers all statuses (pending, retrying, etc.) across the full backlog.
const MAX_QUEUE_SIZE: i64 = 500;

/// The category of a telemetry event. Each variant maps to a per-family opt-out pref,
/// making the complete set of valid families explicit and compiler-checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum EventFamily {
    Event,
    ScreenView,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryPrefs {
    pub enabled: bool,
    pub track_events: bool,
    pub track_screen_views: bool,
    pub track_errors: bool,
    pub include_device_context: bool,
}

impl Default for TelemetryPrefs {
    fn default() -> Self {
        Self {
            enabled: true,
            track_events: true,
            track_screen_views: true,
            track_errors: true,
            include_device_context: true,
        }
    }
}

struct TelemetryInner {
    device_id: String,
    prefs: TelemetryPrefs,
    db: Connection,
    app_version: String,
    platform: String,
    arch: String,
    os_version: String,
    data_dir: PathBuf,
}

pub struct TelemetryManager {
    state: Mutex<Option<TelemetryInner>>,
}

impl Default for TelemetryManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(None),
        }
    }
}

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Reads or generates the persistent anonymous device identifier.
/// Stored as a plain-text UUID in the app-data directory.
fn get_or_create_device_id(data_dir: &PathBuf) -> Result<String, String> {
    let id_path = data_dir.join("syng_device_id.txt");
    if id_path.exists() {
        fs::read_to_string(&id_path)
            .map(|s| s.trim().to_string())
            .map_err(|e| format!("Failed to read device ID: {e}"))
    } else {
        let id = Uuid::new_v4().to_string();
        fs::write(&id_path, &id).map_err(|e| format!("Failed to write device ID: {e}"))?;
        Ok(id)
    }
}

/// Loads telemetry opt-out preferences from a JSON sidecar file.
fn load_prefs(data_dir: &PathBuf) -> TelemetryPrefs {
    let prefs_path = data_dir.join("telemetry_prefs.json");
    fs::read_to_string(prefs_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_prefs(data_dir: &PathBuf, prefs: &TelemetryPrefs) -> Result<(), String> {
    let prefs_path = data_dir.join("telemetry_prefs.json");
    let json =
        serde_json::to_string(prefs).map_err(|e| format!("Failed to serialize prefs: {e}"))?;
    fs::write(prefs_path, json).map_err(|e| format!("Failed to save prefs: {e}"))
}

/// Opens (or creates) the SQLite queue database and ensures the `events` table exists.
fn open_db(data_dir: &PathBuf) -> Result<Connection, String> {
    let db_path = data_dir.join("telemetry_queue.db");
    let conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open telemetry DB: {e}"))?;
    // Single table holds every pending/retrying event; rows are pruned to MAX_QUEUE_SIZE.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            family TEXT NOT NULL,
            name TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            envelope TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to create events table: {e}"))?;
    Ok(conn)
}

/// Writes a single event envelope to the SQLite queue and prunes any overflow.
fn insert_event(
    family: EventFamily,
    name: &str,
    payload: Value,
    inner: &mut TelemetryInner,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let timestamp_ms = now_unix_ms();
    let family_str = serde_json::to_value(family)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_default();

    let mut envelope = json!({
        "id": id,
        "family": family,
        "name": name,
        "timestamp_ms": timestamp_ms,
        "device_id": inner.device_id,
        "app_version": inner.app_version,
        "platform": inner.platform,
        "payload": payload,
    });

    if inner.prefs.include_device_context {
        envelope["device_context"] = json!({
            "arch": inner.arch,
            "os_version": inner.os_version,
        });
    }

    let envelope_str = serde_json::to_string(&envelope)
        .map_err(|e| format!("Failed to serialize envelope: {e}"))?;

    inner
        .db
        .execute(
            "INSERT INTO events (id, family, name, timestamp_ms, envelope, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
            params![
                id,
                family_str,
                name,
                timestamp_ms,
                envelope_str,
                timestamp_ms
            ],
        )
        .map_err(|e| format!("Failed to insert event: {e}"))?;

    // Drop oldest rows beyond the queue cap to prevent unbounded growth.
    inner
        .db
        .execute(
            "DELETE FROM events WHERE id NOT IN (
                SELECT id FROM events ORDER BY created_at DESC LIMIT ?1
            )",
            params![MAX_QUEUE_SIZE],
        )
        .map_err(|e| format!("Failed to prune queue: {e}"))?;

    #[cfg(debug_assertions)]
    println!("[telemetry] {family_str} {name}");

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn make_inner(dir: &TempDir, prefs: TelemetryPrefs) -> TelemetryInner {
        let data_dir: PathBuf = dir.path().to_path_buf();
        let db = open_db(&data_dir).expect("open_db");
        TelemetryInner {
            device_id: "test-device".to_string(),
            prefs,
            db,
            app_version: "0.0.0".to_string(),
            platform: "test".to_string(),
            arch: "x86_64".to_string(),
            os_version: "1.0".to_string(),
            data_dir,
        }
    }

    fn row_count(inner: &TelemetryInner) -> i64 {
        inner
            .db
            .query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0))
            .unwrap()
    }

    // --- TelemetryPrefs defaults ---

    #[test]
    fn test_prefs_default_all_enabled() {
        let p = TelemetryPrefs::default();
        assert!(p.enabled);
        assert!(p.track_events);
        assert!(p.track_screen_views);
        assert!(p.track_errors);
        assert!(p.include_device_context);
    }

    // --- emit_event opt-out behaviour ---

    #[test]
    fn test_emit_event_skipped_when_globally_disabled() {
        let dir = TempDir::new().unwrap();
        let mut prefs = TelemetryPrefs::default();
        prefs.enabled = false;
        let mut inner = make_inner(&dir, prefs);

        emit_event(EventFamily::Event, "test.event", json!({}), &mut inner).unwrap();

        assert_eq!(row_count(&inner), 0);
    }

    #[test]
    fn test_emit_event_skipped_by_events_category() {
        let dir = TempDir::new().unwrap();
        let mut prefs = TelemetryPrefs::default();
        prefs.track_events = false;
        let mut inner = make_inner(&dir, prefs);

        emit_event(EventFamily::Event, "test.event", json!({}), &mut inner).unwrap();

        assert_eq!(row_count(&inner), 0);
    }

    #[test]
    fn test_emit_event_skipped_by_screen_view_category() {
        let dir = TempDir::new().unwrap();
        let mut prefs = TelemetryPrefs::default();
        prefs.track_screen_views = false;
        let mut inner = make_inner(&dir, prefs);

        emit_event(EventFamily::ScreenView, "home", json!({}), &mut inner).unwrap();

        assert_eq!(row_count(&inner), 0);
    }

    #[test]
    fn test_emit_event_skipped_by_error_category() {
        let dir = TempDir::new().unwrap();
        let mut prefs = TelemetryPrefs::default();
        prefs.track_errors = false;
        let mut inner = make_inner(&dir, prefs);

        emit_event(EventFamily::Error, "crash", json!({}), &mut inner).unwrap();

        assert_eq!(row_count(&inner), 0);
    }

    // --- insert_event writes to DB ---

    #[test]
    fn test_insert_event_writes_row() {
        let dir = TempDir::new().unwrap();
        let mut inner = make_inner(&dir, TelemetryPrefs::default());

        insert_event(
            EventFamily::Event,
            "app.launched",
            json!({ "cold": true }),
            &mut inner,
        )
        .unwrap();

        assert_eq!(row_count(&inner), 1);
    }

    #[test]
    fn test_insert_event_row_contains_expected_fields() {
        let dir = TempDir::new().unwrap();
        let mut inner = make_inner(&dir, TelemetryPrefs::default());

        insert_event(EventFamily::ScreenView, "search", json!({}), &mut inner).unwrap();

        let envelope_str: String = inner
            .db
            .query_row("SELECT envelope FROM events LIMIT 1", [], |r| r.get(0))
            .unwrap();
        let envelope: Value = serde_json::from_str(&envelope_str).unwrap();

        assert_eq!(envelope["family"], "screen_view");
        assert_eq!(envelope["name"], "search");
        assert_eq!(envelope["device_id"], "test-device");
        assert!(envelope["timestamp_ms"].is_number());
    }

    #[test]
    fn test_insert_event_omits_device_context_when_disabled() {
        let dir = TempDir::new().unwrap();
        let mut prefs = TelemetryPrefs::default();
        prefs.include_device_context = false;
        let mut inner = make_inner(&dir, prefs);

        insert_event(EventFamily::Event, "test", json!({}), &mut inner).unwrap();

        let envelope_str: String = inner
            .db
            .query_row("SELECT envelope FROM events LIMIT 1", [], |r| r.get(0))
            .unwrap();
        let envelope: Value = serde_json::from_str(&envelope_str).unwrap();

        assert!(envelope.get("device_context").is_none());
    }

    // --- Queue pruning ---

    #[test]
    fn test_queue_pruned_to_max_size() {
        let dir = TempDir::new().unwrap();
        let mut inner = make_inner(&dir, TelemetryPrefs::default());

        // Insert more rows than the cap.
        for i in 0..=(MAX_QUEUE_SIZE + 10) {
            insert_event(EventFamily::Event, "tick", json!({ "i": i }), &mut inner).unwrap();
        }

        assert_eq!(row_count(&inner), MAX_QUEUE_SIZE);
    }

    // --- Device ID persistence ---

    #[test]
    fn test_device_id_created_and_reused() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_path_buf();

        let id1 = get_or_create_device_id(&path).unwrap();
        let id2 = get_or_create_device_id(&path).unwrap();

        assert!(!id1.is_empty());
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_device_id_is_valid_uuid() {
        let dir = TempDir::new().unwrap();
        let id = get_or_create_device_id(&dir.path().to_path_buf()).unwrap();
        assert!(uuid::Uuid::parse_str(&id).is_ok());
    }

    // --- Prefs round-trip ---

    #[test]
    fn test_prefs_save_load_round_trip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_path_buf();

        let mut prefs = TelemetryPrefs::default();
        prefs.enabled = false;
        prefs.track_errors = false;

        save_prefs(&path, &prefs).unwrap();
        let loaded = load_prefs(&path);

        assert!(!loaded.enabled);
        assert!(!loaded.track_errors);
        assert!(loaded.track_events);
    }

    #[test]
    fn test_load_prefs_returns_defaults_when_no_file() {
        let dir = TempDir::new().unwrap();
        let prefs = load_prefs(&dir.path().to_path_buf());
        let defaults = TelemetryPrefs::default();

        assert_eq!(prefs.enabled, defaults.enabled);
        assert_eq!(prefs.track_events, defaults.track_events);
        assert_eq!(prefs.track_screen_views, defaults.track_screen_views);
        assert_eq!(prefs.track_errors, defaults.track_errors);
        assert_eq!(
            prefs.include_device_context,
            defaults.include_device_context
        );
    }
}

/// Checks opt-out prefs and, if the event is allowed, delegates to `insert_event`.
fn emit_event(
    family: EventFamily,
    name: &str,
    payload: Value,
    inner: &mut TelemetryInner,
) -> Result<(), String> {
    let category_enabled = match family {
        EventFamily::Event => inner.prefs.track_events,
        EventFamily::ScreenView => inner.prefs.track_screen_views,
        EventFamily::Error => inner.prefs.track_errors,
    };

    if !inner.prefs.enabled || !category_enabled {
        return Ok(());
    }

    insert_event(family, name, payload, inner)
}

#[tauri::command]
pub fn telemetry_init(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
    os_version: String,
) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let device_id = get_or_create_device_id(&data_dir)?;
    let prefs = load_prefs(&data_dir);
    let db = open_db(&data_dir)?;
    let app_version = app.package_info().version.to_string();
    let platform = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    *lock = Some(TelemetryInner {
        device_id,
        prefs,
        db,
        app_version,
        platform,
        arch,
        os_version,
        data_dir,
    });

    Ok(())
}

#[tauri::command]
pub fn telemetry_track_event(
    name: String,
    payload: Value,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(inner) = lock.as_mut() {
        emit_event(EventFamily::Event, &name, payload, inner)?;
    }
    Ok(())
}

#[tauri::command]
pub fn telemetry_track_screen(
    name: String,
    payload: Value,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(inner) = lock.as_mut() {
        emit_event(EventFamily::ScreenView, &name, payload, inner)?;
    }
    Ok(())
}

#[tauri::command]
pub fn telemetry_track_error(
    name: String,
    message: String,
    payload: Value,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(inner) = lock.as_mut() {
        let error_payload = if let Value::Object(mut map) = payload {
            map.insert("message".to_string(), Value::String(message));
            Value::Object(map)
        } else {
            json!({ "message": message })
        };
        emit_event(EventFamily::Error, &name, error_payload, inner)?;
    }
    Ok(())
}

#[tauri::command]
pub fn telemetry_get_queued_events(
    limit: i64,
    state: State<'_, TelemetryManager>,
) -> Result<Vec<Value>, String> {
    let lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(inner) = lock.as_ref() {
        let mut stmt = inner
            .db
            .prepare("SELECT envelope FROM events ORDER BY created_at DESC LIMIT ?1")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let envelopes: Vec<String> = stmt
            .query_map(params![limit], |row| row.get(0))
            .map_err(|e| format!("Query failed: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        let events = envelopes
            .into_iter()
            .filter_map(|s| serde_json::from_str(&s).ok())
            .collect();

        Ok(events)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn telemetry_get_prefs(state: State<'_, TelemetryManager>) -> Result<TelemetryPrefs, String> {
    let lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    Ok(lock
        .as_ref()
        .map(|inner| inner.prefs.clone())
        .unwrap_or_default())
}

#[tauri::command]
pub fn telemetry_set_pref(
    key: String,
    value: bool,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(inner) = lock.as_mut() {
        match key.as_str() {
            "enabled" => {
                // Emit before updating so the event fires regardless of the new state.
                let _ = insert_event(
                    EventFamily::Event,
                    "telemetry.toggled",
                    json!({ "enabled": value }),
                    inner,
                );
                inner.prefs.enabled = value;
            }
            // Always record category changes so we can correlate event-volume drops in analytics.
            "track_events" => {
                let _ = insert_event(
                    EventFamily::Event,
                    "telemetry.category_toggled",
                    json!({ "category": "track_events", "enabled": value }),
                    inner,
                );
                inner.prefs.track_events = value;
            }
            "track_screen_views" => {
                let _ = insert_event(
                    EventFamily::Event,
                    "telemetry.category_toggled",
                    json!({ "category": "track_screen_views", "enabled": value }),
                    inner,
                );
                inner.prefs.track_screen_views = value;
            }
            "track_errors" => {
                let _ = insert_event(
                    EventFamily::Event,
                    "telemetry.category_toggled",
                    json!({ "category": "track_errors", "enabled": value }),
                    inner,
                );
                inner.prefs.track_errors = value;
            }
            "include_device_context" => {
                let _ = insert_event(
                    EventFamily::Event,
                    "telemetry.category_toggled",
                    json!({ "category": "include_device_context", "enabled": value }),
                    inner,
                );
                inner.prefs.include_device_context = value;
            }
            _ => return Err(format!("Unknown preference key: {key}")),
        }
        save_prefs(&inner.data_dir, &inner.prefs)?;
    }
    Ok(())
}

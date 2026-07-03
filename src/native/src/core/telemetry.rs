//! Telemetry pipeline for Syng.
//!
//! Events are bucketed into one of three families — Event, ScreenView, or Error —
//! and written to a local SQLite queue (`telemetry_queue.db` in the app-data dir).
//! A background flush batch-sends queued rows to the analytics backend using a
//! per-installation bearer token; unsent rows accumulate locally and can be inspected
//! in the Telemetry Settings panel.
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
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

/// Total number of events retained in the local queue before oldest rows are dropped.
/// This cap covers all statuses (pending, retrying, etc.) across the full backlog.
const MAX_QUEUE_SIZE: i64 = 500;

/// Base URL for the analytics backend during local development and testing. Debug builds
/// (`cfg!(debug_assertions)`) send here so real production data is never polluted by dev traffic.
const TELEMETRY_BASE_URL_DEV: &str = "http://localhost:8787";
/// Base URL for the analytics backend in shipped (release) builds.
const TELEMETRY_BASE_URL_PROD: &str = "https://telemetry.syng.app";
/// Path appended to the base URL that accepts a batch of event envelopes (bearer-authorized).
const TELEMETRY_EVENTS_PATH: &str = "/telemetry";
/// Path appended to the base URL that mints a per-installation telemetry token.
const TELEMETRY_INSTALLATIONS_PATH: &str = "/telemetry/installations";
/// Filename (under the app-data dir) holding the persisted installation token and its expiry.
const INSTALLATION_FILE: &str = "telemetry_installation.json";

/// How long the background flush loop waits between send attempts.
const FLUSH_INTERVAL: Duration = Duration::from_secs(60);
/// Maximum number of queued events pulled from SQLite and sent in a single POST.
const FLUSH_BATCH_SIZE: i64 = 50;
/// Per-request timeout for the outbound HTTP call.
const FLUSH_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// Selects the analytics base URL by build type: local endpoint for debug builds, production
/// endpoint for release builds. Mirrors the `cfg!(debug_assertions)` split used by `is_dev_build`.
fn telemetry_base_url() -> &'static str {
    if cfg!(debug_assertions) {
        TELEMETRY_BASE_URL_DEV
    } else {
        TELEMETRY_BASE_URL_PROD
    }
}

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
    timezone: String,
    data_dir: PathBuf,
}

pub struct TelemetryManager {
    state: Mutex<Option<TelemetryInner>>,
    /// Guards the background flush loop so repeated `telemetry_init` calls can't spawn duplicates.
    flush_started: AtomicBool,
}

impl Default for TelemetryManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(None),
            flush_started: AtomicBool::new(false),
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
fn get_or_create_device_id(data_dir: &Path) -> Result<String, String> {
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
fn load_prefs(data_dir: &Path) -> TelemetryPrefs {
    let prefs_path = data_dir.join("telemetry_prefs.json");
    fs::read_to_string(prefs_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_prefs(data_dir: &Path, prefs: &TelemetryPrefs) -> Result<(), String> {
    let prefs_path = data_dir.join("telemetry_prefs.json");
    let json =
        serde_json::to_string(prefs).map_err(|e| format!("Failed to serialize prefs: {e}"))?;
    fs::write(prefs_path, json).map_err(|e| format!("Failed to save prefs: {e}"))
}

/// Opens (or creates) the SQLite queue database and ensures the `events` table exists.
fn open_db(data_dir: &Path) -> Result<Connection, String> {
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
            "timezone": inner.timezone,
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
// Transport
// ---------------------------------------------------------------------------

/// A per-installation credential issued by the backend. Persisted to `INSTALLATION_FILE` so the
/// same token is reused across launches until it expires (or is rejected with a 401).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Installation {
    installation_id: String,
    telemetry_token: String,
    /// RFC 3339 timestamp produced by the backend (`DEFAULT_TELEMETRY_TOKEN_TTL_DAYS` in the future).
    expires_at: String,
}

/// The subset of `TelemetryInner` the flush loop needs, snapshotted under a single lock so no
/// `MutexGuard`/`Connection` is ever held across an `.await`. `app_version`/`platform` mirror the
/// required event-envelope fields; `arch`/`os_version` are only sent when the device-context
/// opt-out is on, matching how `insert_event` gates `device_context`.
struct FlushContext {
    data_dir: PathBuf,
    app_version: String,
    platform: String,
    arch: String,
    os_version: String,
    include_device_context: bool,
}

/// Outcome of a single event-batch POST, distinguishing an auth rejection (which triggers a
/// re-register + retry) from other failures (which simply leave the rows queued).
enum SendOutcome {
    Success,
    Unauthorized,
    Failed,
}

/// Wraps a batch of event envelopes in the request body expected by the backend.
/// Kept as a pure function so the payload shape is unit-testable without a network.
fn build_batch_body(events: Vec<Value>) -> Value {
    json!({ "events": events })
}

/// Builds the registration request body for `POST /telemetry/installations`. All fields are
/// optional server-side; `device_context` is included only when the opt-out pref allows it.
/// Pure function so the shape is unit-testable without a network.
fn build_registration_body(context: &FlushContext) -> Value {
    let mut body = json!({
        "app_version": context.app_version,
        "platform": context.platform,
    });
    if context.include_device_context {
        body["device_context"] = json!({
            "arch": context.arch,
            "os_version": context.os_version,
        });
    }
    body
}

fn installation_path(data_dir: &Path) -> PathBuf {
    data_dir.join(INSTALLATION_FILE)
}

/// Reads the persisted installation token, if any. A missing or unparseable file yields `None`,
/// which triggers a fresh registration.
fn load_installation(data_dir: &Path) -> Option<Installation> {
    fs::read_to_string(installation_path(data_dir))
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
}

fn save_installation(data_dir: &Path, installation: &Installation) {
    if let Ok(json) = serde_json::to_string(installation) {
        let _ = fs::write(installation_path(data_dir), json);
    }
}

fn clear_installation(data_dir: &Path) {
    let _ = fs::remove_file(installation_path(data_dir));
}

/// Whether a stored token is past its `expires_at`. An unparseable timestamp is treated as valid
/// so we don't loop on re-registration — the authoritative expiry signal is a 401 from the server.
fn installation_is_expired(installation: &Installation) -> bool {
    match chrono::DateTime::parse_from_rfc3339(&installation.expires_at) {
        Ok(expires) => expires.timestamp() <= now_unix_ms() / 1000,
        Err(_) => false,
    }
}

/// Snapshots the flush context and the oldest pending batch under one lock. Returns `None` when
/// telemetry has not been initialized. The batch may be empty (nothing queued).
fn take_pending(manager: &TelemetryManager) -> Option<(FlushContext, Vec<(String, Value)>)> {
    let lock = manager.state.lock().ok()?;
    let inner = lock.as_ref()?;

    let context = FlushContext {
        data_dir: inner.data_dir.clone(),
        app_version: inner.app_version.clone(),
        platform: inner.platform.clone(),
        arch: inner.arch.clone(),
        os_version: inner.os_version.clone(),
        include_device_context: inner.prefs.include_device_context,
    };

    let mut stmt = inner
        .db
        .prepare("SELECT id, envelope FROM events ORDER BY created_at ASC LIMIT ?1")
        .ok()?;
    let rows = stmt
        .query_map(params![FLUSH_BATCH_SIZE], |row| {
            let id: String = row.get(0)?;
            let envelope: String = row.get(1)?;
            Ok((id, envelope))
        })
        .ok()?;

    let batch = rows
        .filter_map(Result::ok)
        .filter_map(|(id, envelope)| {
            serde_json::from_str(&envelope)
                .ok()
                .map(|value| (id, value))
        })
        .collect();

    Some((context, batch))
}

/// Deletes successfully-sent rows from the queue. Runs after the HTTP call returns, re-acquiring
/// the lock briefly. Unknown ids (already pruned) are simply no-ops.
fn delete_sent_events(manager: &TelemetryManager, ids: &[String]) {
    if ids.is_empty() {
        return;
    }
    let lock = match manager.state.lock() {
        Ok(lock) => lock,
        Err(_) => return,
    };
    if let Some(inner) = lock.as_ref() {
        let placeholders = std::iter::repeat_n("?", ids.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("DELETE FROM events WHERE id IN ({placeholders})");
        let params = rusqlite::params_from_iter(ids.iter());
        let _ = inner.db.execute(&sql, params);
    }
}

/// Registers a fresh installation with the backend and persists the returned token. Returns `None`
/// on any network/parse failure, leaving events queued for a later attempt.
async fn register_installation(
    client: &reqwest::Client,
    context: &FlushContext,
) -> Option<Installation> {
    let url = format!("{}{}", telemetry_base_url(), TELEMETRY_INSTALLATIONS_PATH);
    let response = client
        .post(&url)
        .json(&build_registration_body(context))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        #[cfg(debug_assertions)]
        println!(
            "[telemetry] registration rejected: HTTP {}",
            response.status()
        );
        return None;
    }
    let installation: Installation = response.json().await.ok()?;
    save_installation(&context.data_dir, &installation);
    Some(installation)
}

/// Returns a usable installation token: the persisted one when present and unexpired, otherwise a
/// freshly registered one.
async fn ensure_installation(
    client: &reqwest::Client,
    context: &FlushContext,
) -> Option<Installation> {
    if let Some(installation) = load_installation(&context.data_dir) {
        if !installation_is_expired(&installation) {
            return Some(installation);
        }
    }
    register_installation(client, context).await
}

/// POSTs one event batch with a bearer token, classifying the response so the caller can decide
/// whether to re-register (401) or leave the rows queued (any other failure).
async fn send_batch(client: &reqwest::Client, token: &str, body: &Value) -> SendOutcome {
    let url = format!("{}{}", telemetry_base_url(), TELEMETRY_EVENTS_PATH);
    match client.post(&url).bearer_auth(token).json(body).send().await {
        Ok(response) if response.status().is_success() => SendOutcome::Success,
        Ok(response) if response.status() == reqwest::StatusCode::UNAUTHORIZED => {
            SendOutcome::Unauthorized
        }
        Ok(_response) => {
            #[cfg(debug_assertions)]
            println!("[telemetry] flush rejected: HTTP {}", _response.status());
            SendOutcome::Failed
        }
        Err(_error) => {
            #[cfg(debug_assertions)]
            println!("[telemetry] flush failed: {_error}");
            SendOutcome::Failed
        }
    }
}

/// Sends one batch of queued events to the analytics backend. Reads the batch (releasing the lock),
/// ensures an installation token, POSTs the batch with bearer auth, and deletes the sent rows on
/// success. A 401 clears the stored token, re-registers once, and retries the batch once. Any other
/// failure leaves the rows in place for the next tick (still bounded by `MAX_QUEUE_SIZE` pruning).
async fn flush_once(app: &AppHandle, client: &reqwest::Client) {
    let manager = app.state::<TelemetryManager>();
    let Some((context, batch)) = take_pending(&manager) else {
        return;
    };
    if batch.is_empty() {
        return;
    }

    let (ids, envelopes): (Vec<String>, Vec<Value>) = batch.into_iter().unzip();

    let Some(installation) = ensure_installation(client, &context).await else {
        return;
    };

    let body = build_batch_body(envelopes);
    match send_batch(client, &installation.telemetry_token, &body).await {
        SendOutcome::Success => delete_sent_events(&manager, &ids),
        SendOutcome::Unauthorized => {
            // The stored token was revoked or expired: drop it, register once more, and retry.
            clear_installation(&context.data_dir);
            if let Some(fresh) = register_installation(client, &context).await {
                if let SendOutcome::Success =
                    send_batch(client, &fresh.telemetry_token, &body).await
                {
                    delete_sent_events(&manager, &ids);
                }
            }
        }
        SendOutcome::Failed => {}
    }
}

/// Spawns the background flush loop exactly once. The `flush_started` guard makes a repeated
/// `telemetry_init` a no-op so we never run duplicate loops against the same queue.
fn start_flush_loop(app: &AppHandle, manager: &TelemetryManager) {
    if manager.flush_started.swap(true, Ordering::SeqCst) {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(FLUSH_REQUEST_TIMEOUT)
            .build()
        {
            Ok(client) => client,
            Err(_) => return,
        };

        loop {
            tokio::time::sleep(FLUSH_INTERVAL).await;
            flush_once(&app, &client).await;
        }
    });
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
            timezone: "America/New_York".to_string(),
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
    fn test_insert_event_includes_timezone_in_device_context() {
        let dir = TempDir::new().unwrap();
        let mut inner = make_inner(&dir, TelemetryPrefs::default());

        insert_event(EventFamily::Event, "test", json!({}), &mut inner).unwrap();

        let envelope_str: String = inner
            .db
            .query_row("SELECT envelope FROM events LIMIT 1", [], |r| r.get(0))
            .unwrap();
        let envelope: Value = serde_json::from_str(&envelope_str).unwrap();

        assert_eq!(envelope["device_context"]["timezone"], "America/New_York");
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

        // The whole device_context object (timezone included) is withheld when the pref is off.
        assert!(envelope.get("device_context").is_none());
    }

    // --- Transport helpers ---

    #[test]
    fn test_telemetry_base_url_selects_dev_in_debug() {
        // Unit tests compile with debug_assertions on, so the dev endpoint is selected.
        assert_eq!(telemetry_base_url(), TELEMETRY_BASE_URL_DEV);
    }

    #[test]
    fn test_build_batch_body_wraps_events() {
        let body = build_batch_body(vec![json!({ "name": "a" }), json!({ "name": "b" })]);
        assert!(body["events"].is_array());
        assert_eq!(body["events"].as_array().unwrap().len(), 2);
        assert_eq!(body["events"][0]["name"], "a");
    }

    fn make_context(dir: &TempDir, include_device_context: bool) -> FlushContext {
        FlushContext {
            data_dir: dir.path().to_path_buf(),
            app_version: "2.0.0".to_string(),
            platform: "macos".to_string(),
            arch: "aarch64".to_string(),
            os_version: "14.0".to_string(),
            include_device_context,
        }
    }

    #[test]
    fn test_build_registration_body_includes_device_context_when_enabled() {
        let dir = TempDir::new().unwrap();
        let body = build_registration_body(&make_context(&dir, true));
        assert_eq!(body["app_version"], "2.0.0");
        assert_eq!(body["platform"], "macos");
        assert_eq!(body["device_context"]["arch"], "aarch64");
        assert_eq!(body["device_context"]["os_version"], "14.0");
    }

    #[test]
    fn test_build_registration_body_omits_device_context_when_disabled() {
        let dir = TempDir::new().unwrap();
        let body = build_registration_body(&make_context(&dir, false));
        assert_eq!(body["app_version"], "2.0.0");
        assert!(body.get("device_context").is_none());
    }

    #[test]
    fn test_installation_round_trips() {
        let dir = TempDir::new().unwrap();
        let path = dir.path();
        assert!(load_installation(path).is_none());

        let installation = Installation {
            installation_id: "install-1".to_string(),
            telemetry_token: "syrv_tlm_abc".to_string(),
            expires_at: "2999-01-01T00:00:00Z".to_string(),
        };
        save_installation(path, &installation);

        let loaded = load_installation(path).unwrap();
        assert_eq!(loaded.installation_id, "install-1");
        assert_eq!(loaded.telemetry_token, "syrv_tlm_abc");

        clear_installation(path);
        assert!(load_installation(path).is_none());
    }

    #[test]
    fn test_installation_expiry_detection() {
        let past = Installation {
            installation_id: "i".to_string(),
            telemetry_token: "t".to_string(),
            expires_at: "2000-01-01T00:00:00Z".to_string(),
        };
        let future = Installation {
            expires_at: "2999-01-01T00:00:00Z".to_string(),
            ..past.clone()
        };
        let unparseable = Installation {
            expires_at: "not-a-timestamp".to_string(),
            ..past.clone()
        };

        assert!(installation_is_expired(&past));
        assert!(!installation_is_expired(&future));
        // Unparseable expiry is treated as valid; the 401 path is the authoritative signal.
        assert!(!installation_is_expired(&unparseable));
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

/// Emits an `Event`-family telemetry event from native (non-command) code paths.
///
/// Reuses the same SQLite queue and per-family opt-out handling as the JS-facing
/// `telemetry_*` commands. This is the entry point for events recorded by native
/// platform code (e.g. iOS web-content-process recovery), where the JS bridge may not
/// be running. Silently no-ops if telemetry has not been initialized yet.
#[cfg(target_os = "ios")]
pub fn track_event_native(manager: &TelemetryManager, name: &str, payload: Value) {
    if let Ok(mut lock) = manager.state.lock() {
        if let Some(inner) = lock.as_mut() {
            let _ = emit_event(EventFamily::Event, name, payload, inner);
        }
    }
}

#[tauri::command]
pub fn telemetry_init(
    app: AppHandle,
    state: State<'_, TelemetryManager>,
    os_version: String,
    timezone: String,
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

    {
        let mut lock = state.state.lock().map_err(|e| format!("Lock error: {e}"))?;
        *lock = Some(TelemetryInner {
            device_id,
            prefs,
            db,
            app_version,
            platform,
            arch,
            os_version,
            timezone,
            data_dir,
        });
    }

    // Begin periodically flushing the queue to the analytics backend (spawns at most once).
    start_flush_loop(&app, state.inner());

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

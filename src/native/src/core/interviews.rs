//! Explicit interview signups. Contact details never pass through the telemetry queue.

use crate::core::TelemetryManager;
use crate::utils::syrver::{syrver_url, INTERVIEWS_PATH};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tokio::{sync::Notify, task::AbortHandle};
use uuid::Uuid;

const CONSENT_VERSION: &str = "interviews-v1";
const PENDING_LIFETIME: i64 = 7 * 24 * 60 * 60;

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InterviewSignup {
    signup_id: String,
    preferred_name: String,
    email: String,
    consent: bool,
    consent_version: String,
}

impl InterviewSignup {
    fn validate(&mut self) -> Result<(), String> {
        self.preferred_name = self.preferred_name.trim().to_string();
        self.email = self.email.trim().to_string();
        let parts: Vec<_> = self.email.split('@').collect();
        if Uuid::parse_str(&self.signup_id).is_err()
            || self.preferred_name.is_empty()
            || self.preferred_name.chars().count() > 80
            || self.preferred_name.chars().any(char::is_control)
            || self.email.len() > 254
            || self
                .email
                .chars()
                .any(|c| c.is_whitespace() || c.is_control())
            || parts.len() != 2
            || parts.iter().any(|part| part.is_empty())
            || !self.consent
            || self.consent_version != CONSENT_VERSION
        {
            return Err("invalid_input".to_string());
        }
        Ok(())
    }
}

#[derive(Clone, Deserialize, Serialize)]
struct SignupRequest {
    #[serde(flatten)]
    signup: InterviewSignup,
    device_id: String,
}

/// The backend contract deliberately excludes the local consent checkbox value: validating true
/// consent happens before this record is queued, and the accepted consent version is transmitted.
#[derive(Serialize)]
struct InterviewRequest<'a> {
    signup_id: &'a str,
    preferred_name: &'a str,
    email: &'a str,
    device_id: &'a str,
    consent_version: &'a str,
}

impl<'a> From<&'a SignupRequest> for InterviewRequest<'a> {
    fn from(request: &'a SignupRequest) -> Self {
        Self {
            signup_id: &request.signup.signup_id,
            preferred_name: &request.signup.preferred_name,
            email: &request.signup.email,
            device_id: &request.device_id,
            consent_version: &request.signup.consent_version,
        }
    }
}

#[derive(Debug, PartialEq)]
enum Delivery {
    Delivered,
    Rejected,
    Unauthorized,
    Retry(u64),
}

async fn send_signup(
    client: &reqwest::Client,
    url: &str,
    request: &SignupRequest,
    token: &str,
) -> Delivery {
    let payload = InterviewRequest::from(request);
    let Ok(response) = client
        .post(url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
    else {
        return Delivery::Retry(0);
    };
    // Never read or log response bodies: they may echo contact details.
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| {
            v.parse::<u64>().ok().or_else(|| {
                chrono::DateTime::parse_from_rfc2822(v)
                    .ok()
                    .map(|date| date.timestamp().saturating_sub(now()).max(0) as u64)
            })
        })
        .unwrap_or(0);
    match response.status().as_u16() {
        200 => Delivery::Delivered,
        401 => Delivery::Unauthorized,
        429 => Delivery::Retry(retry_after.max(3600)),
        408 | 500..=599 => Delivery::Retry(retry_after),
        _ => Delivery::Rejected,
    }
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn unavailable(_: impl std::fmt::Display) -> String {
    // In particular, do not expose SQLite errors containing contact data.
    "unavailable".into()
}

struct Queue {
    db: Connection,
    blocked: bool,
    in_flight: Option<AbortHandle>,
}

impl Queue {
    fn open(path: &Path) -> Result<Self, String> {
        let mut options = std::fs::OpenOptions::new();
        options.create(true).append(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options.open(path).map_err(unavailable)?;
        let db = Connection::open(path).map_err(unavailable)?;
        db.execute_batch(
            "PRAGMA secure_delete = ON;
            PRAGMA journal_mode = DELETE;
            PRAGMA synchronous = FULL;
            CREATE TABLE IF NOT EXISTS pending (
                slot INTEGER PRIMARY KEY CHECK (slot = 1),
                id TEXT NOT NULL, payload TEXT NOT NULL,
                expires_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );",
        )
        .map_err(unavailable)?;
        Ok(Self {
            db,
            blocked: true,
            in_flight: None,
        })
    }

    fn cancel(&mut self) -> Result<(), String> {
        if let Some(task) = self.in_flight.take() {
            task.abort();
        }
        self.db
            .execute("DELETE FROM pending", [])
            .map_err(unavailable)?;
        Ok(())
    }

    fn set_child_mode(&mut self, blocked: bool, timestamp: i64) -> Result<(), String> {
        // Age classification may proceed if storage fails. Keep delivery disabled until
        // all storage work succeeds, including when reconfiguring a running worker.
        self.blocked = true;
        if let Some(task) = self.in_flight.take() {
            task.abort();
        }
        if blocked {
            self.cancel()?;
        }
        self.expire(timestamp)?;
        self.blocked = blocked;
        Ok(())
    }

    fn expire(&self, timestamp: i64) -> Result<(), String> {
        self.db
            .execute("DELETE FROM pending WHERE expires_at <= ?1", [timestamp])
            .map_err(unavailable)?;
        Ok(())
    }

    fn enqueue(&mut self, request: &SignupRequest, timestamp: i64) -> Result<(), String> {
        if self.blocked {
            return Err("invalid_input".into());
        }
        self.expire(timestamp)?;
        let payload = serde_json::to_string(request).map_err(unavailable)?;
        let existing: Option<(String, String)> = self
            .db
            .query_row("SELECT id, payload FROM pending", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .optional()
            .map_err(unavailable)?;
        if let Some((id, previous)) = existing {
            if id == request.signup.signup_id {
                return if payload == previous {
                    Ok(())
                } else {
                    Err("invalid_input".into())
                };
            }
        }
        // One pending signup per installation. Replays replace it atomically.
        self.db
            .execute(
                "INSERT OR REPLACE INTO pending
            (slot, id, payload, expires_at, next_attempt, attempts) VALUES (1, ?1, ?2, ?3, ?4, 0)",
                params![
                    request.signup.signup_id,
                    payload,
                    timestamp + PENDING_LIFETIME,
                    timestamp
                ],
            )
            .map_err(unavailable)?;
        if let Some(task) = self.in_flight.take() {
            task.abort();
        }
        Ok(())
    }

    fn due(&self, timestamp: i64) -> Result<Option<SignupRequest>, String> {
        self.expire(timestamp)?;
        if self.blocked {
            return Ok(None);
        }
        let row: Option<(String, u32)> = self
            .db
            .query_row(
                "SELECT payload, attempts FROM pending WHERE next_attempt <= ?1",
                [timestamp],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(unavailable)?;
        let Some((payload, attempts)) = row else {
            return Ok(None);
        };
        let mut request: SignupRequest = serde_json::from_str(&payload).map_err(unavailable)?;
        if request.signup.validate().is_err() {
            self.db
                .execute("DELETE FROM pending", [])
                .map_err(unavailable)?;
            return Ok(None);
        }
        // Persist the next attempt BEFORE sending, so a crash cannot reset backoff.
        let delay = retry_delay(attempts, rand::random::<u32>());
        self.db
            .execute(
                "UPDATE pending SET attempts = attempts + 1, next_attempt = ?1",
                [timestamp.saturating_add(delay as i64)],
            )
            .map_err(unavailable)?;
        Ok(Some(request))
    }

    fn finish(&self, id: &str, outcome: Delivery, timestamp: i64) -> Result<(), String> {
        match outcome {
            Delivery::Delivered | Delivery::Rejected => {
                self.db
                    .execute("DELETE FROM pending WHERE id = ?1", [id])
                    .map_err(unavailable)?;
            }
            Delivery::Retry(delay) => self.defer(id, delay, timestamp)?,
            // Keep consented contact details if a caller fails to refresh a rejected credential.
            Delivery::Unauthorized => self.defer(id, 0, timestamp)?,
        }
        Ok(())
    }

    fn defer(&self, id: &str, delay: u64, timestamp: i64) -> Result<(), String> {
        self.db
            .execute(
                "UPDATE pending SET next_attempt = MAX(next_attempt, ?1) WHERE id = ?2",
                params![
                    timestamp.saturating_add(delay.min(i64::MAX as u64) as i64),
                    id
                ],
            )
            .map_err(unavailable)?;
        Ok(())
    }
}

fn retry_delay(attempts: u32, jitter: u32) -> u64 {
    let base = (30u64 * (1u64 << attempts.min(12))).min(6 * 3600);
    base + u64::from(jitter) % (base / 4 + 1)
}

#[derive(Default)]
pub struct InterviewManager {
    queue: Mutex<Option<Queue>>,
    started: AtomicBool,
    wake: Notify,
}

async fn flush_pending(app: &AppHandle) -> Result<(), String> {
    let manager = app.state::<InterviewManager>();
    let (id, task) = {
        let mut guard = manager.queue.lock().map_err(unavailable)?;
        let queue = guard.as_mut().ok_or_else(|| "unavailable".to_string())?;
        let Some(request) = queue.due(now())? else {
            return Ok(());
        };
        let id = request.signup.signup_id.clone();
        let app = app.clone();
        // Register cancellation while holding the same lock used to cancel/replace the queue.
        let task = tokio::spawn(async move {
            let Ok(client) = reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::none())
                .build()
            else {
                return Delivery::Retry(0);
            };
            let telemetry = app.state::<TelemetryManager>();
            let Some(token) = telemetry.interview_token(&client).await else {
                return Delivery::Retry(0);
            };
            let url = syrver_url(INTERVIEWS_PATH);
            match send_signup(&client, &url, &request, &token).await {
                Delivery::Unauthorized => {
                    let Some(token) = telemetry.refresh_interview_token(&client).await else {
                        return Delivery::Retry(0);
                    };
                    match send_signup(&client, &url, &request, &token).await {
                        // A second authorization failure is transient from the signup queue's
                        // perspective: retain the explicit consent rather than discarding it.
                        Delivery::Unauthorized => Delivery::Retry(0),
                        outcome => outcome,
                    }
                }
                outcome => outcome,
            }
        });
        queue.in_flight = Some(task.abort_handle());
        (id, task)
    };
    let result = task.await;
    let mut guard = manager.queue.lock().map_err(unavailable)?;
    if let Some(queue) = guard.as_mut() {
        queue.in_flight = None;
        if let Ok(outcome) = result {
            queue.finish(&id, outcome, now())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn interviews_init(
    app: AppHandle,
    state: State<'_, InterviewManager>,
    child_privacy_mode: bool,
) -> Result<(), String> {
    {
        let mut guard = state.queue.lock().map_err(unavailable)?;
        if guard.is_none() {
            let dir = app.path().app_data_dir().map_err(unavailable)?;
            std::fs::create_dir_all(&dir).map_err(unavailable)?;
            *guard = Some(Queue::open(&dir.join("interview-signup.sqlite"))?);
        }
        let queue = guard.as_mut().unwrap();
        queue.set_child_mode(child_privacy_mode, now())?;
    }
    if !state.started.swap(true, Ordering::SeqCst) {
        tauri::async_runtime::spawn(async move {
            loop {
                let manager = app.state::<InterviewManager>();
                // Only a single worker exists; wake immediately on a new signup.
                tokio::select! {
                    _ = manager.wake.notified() => {},
                    _ = tokio::time::sleep(Duration::from_secs(15)) => {},
                }
                let _ = flush_pending(&app).await;
            }
        });
    }
    state.wake.notify_one();
    Ok(())
}

#[tauri::command]
pub fn interview_signup(
    mut signup: InterviewSignup,
    state: State<'_, TelemetryManager>,
    interviews: State<'_, InterviewManager>,
) -> Result<(), String> {
    signup.validate()?;
    let request = SignupRequest {
        signup,
        device_id: state.interview_device_id()?,
    };
    {
        let mut guard = interviews.queue.lock().map_err(unavailable)?;
        let queue = guard.as_mut().ok_or_else(|| "unavailable".to_string())?;
        queue.enqueue(&request, now())?;
    }
    interviews.wake.notify_one();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> SignupRequest {
        let mut input = signup();
        input.validate().unwrap();
        SignupRequest {
            signup: input,
            device_id: "test-device".into(),
        }
    }

    #[test]
    fn pending_signup_survives_restart_with_identical_payload_and_backoff() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("queue.sqlite");
        let input = request();
        let mut queue = Queue::open(&path).unwrap();
        queue.set_child_mode(false, 100).unwrap();
        queue.enqueue(&input, 100).unwrap();
        let first = queue.due(100).unwrap().unwrap();
        assert_eq!(
            serde_json::to_string(&first).unwrap(),
            serde_json::to_string(&input).unwrap()
        );
        queue
            .finish(&input.signup.signup_id, Delivery::Retry(3600), 100)
            .unwrap();
        // Repeated clicks do not reset the persisted cooldown or extend expiry.
        queue.enqueue(&input, 101).unwrap();
        drop(queue);
        let mut reopened = Queue::open(&path).unwrap();
        assert!(reopened.due(3700).unwrap().is_none()); // blocked until age preferences load
        reopened.set_child_mode(false, 3700).unwrap();
        assert!(reopened.due(3699).unwrap().is_none());
        let retried = reopened.due(3700).unwrap().unwrap();
        assert_eq!(
            serde_json::to_string(&retried).unwrap(),
            serde_json::to_string(&input).unwrap()
        );
        let expiry: i64 = reopened
            .db
            .query_row("SELECT expires_at FROM pending", [], |r| r.get(0))
            .unwrap();
        assert_eq!(expiry, 100 + PENDING_LIFETIME);
    }

    #[test]
    fn delivered_rejected_cancelled_and_expired_signups_remove_local_contacts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("queue.sqlite");
        let mut queue = Queue::open(&path).unwrap();
        queue.set_child_mode(false, 100).unwrap();
        for outcome in [Delivery::Delivered, Delivery::Rejected] {
            let input = request();
            queue.enqueue(&input, 100).unwrap();
            queue.finish(&input.signup.signup_id, outcome, 100).unwrap();
            assert!(queue.due(100).unwrap().is_none());
            assert!(!std::fs::read(&path)
                .unwrap()
                .windows(input.signup.email.len())
                .any(|w| w == input.signup.email.as_bytes()));
        }
        queue.enqueue(&request(), 100).unwrap();
        queue.cancel().unwrap();
        assert!(queue.due(100).unwrap().is_none());
        queue.enqueue(&request(), 100).unwrap();
        assert!(queue.due(100 + PENDING_LIFETIME).unwrap().is_none());
        assert_eq!(
            queue
                .db
                .query_row("SELECT COUNT(*) FROM pending", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn unauthorized_delivery_keeps_the_signup_for_a_later_retry() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("queue.sqlite");
        let mut queue = Queue::open(&path).unwrap();
        queue.set_child_mode(false, 100).unwrap();
        let input = request();
        queue.enqueue(&input, 100).unwrap();

        queue
            .finish(&input.signup.signup_id, Delivery::Unauthorized, 100)
            .unwrap();

        let pending = queue.due(100).unwrap().unwrap();
        assert_eq!(pending.signup.signup_id, input.signup.signup_id);
        assert_eq!(pending.signup.email, input.signup.email);
    }

    #[tokio::test]
    async fn cancellation_aborts_in_flight_delivery_and_child_mode_rejects_new_signups() {
        let dir = tempfile::tempdir().unwrap();
        let mut queue = Queue::open(&dir.path().join("queue.sqlite")).unwrap();
        queue.set_child_mode(false, 100).unwrap();
        queue.enqueue(&request(), 100).unwrap();
        let task = tokio::spawn(std::future::pending::<()>());
        queue.in_flight = Some(task.abort_handle());
        queue.set_child_mode(true, 100).unwrap();
        assert!(task.await.unwrap_err().is_cancelled());
        assert!(queue.due(100).unwrap().is_none());
        assert_eq!(queue.enqueue(&request(), 100), Err("invalid_input".into()));
        queue.set_child_mode(false, 100).unwrap();
        assert!(queue.due(100).unwrap().is_none());
    }

    #[test]
    fn replacing_signup_cannot_be_deleted_by_an_old_response_or_reuse_an_id_for_new_details() {
        let dir = tempfile::tempdir().unwrap();
        let mut queue = Queue::open(&dir.path().join("queue.sqlite")).unwrap();
        queue.set_child_mode(false, 100).unwrap();
        let original = request();
        queue.enqueue(&original, 100).unwrap();
        let mut edited = original.clone();
        edited.signup.email = "different@example.invalid".into();
        assert_eq!(queue.enqueue(&edited, 100), Err("invalid_input".into()));
        edited.signup.signup_id = Uuid::new_v4().to_string();
        queue.enqueue(&edited, 100).unwrap();
        queue
            .finish(&original.signup.signup_id, Delivery::Delivered, 100)
            .unwrap();
        assert_eq!(
            queue.due(100).unwrap().unwrap().signup.email,
            edited.signup.email
        );
    }

    #[test]
    fn retries_back_off_with_bounded_jitter() {
        assert_eq!(retry_delay(0, 0), 30);
        assert_eq!(retry_delay(1, 0), 60);
        assert!(retry_delay(2, 10) > 120);
        assert!((21600..=27000).contains(&retry_delay(u32::MAX, u32::MAX)));
    }

    #[test]
    fn unavailable_or_corrupt_storage_cannot_initialize_a_queue() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            Queue::open(&dir.path().join("missing/queue.sqlite")).err(),
            Some("unavailable".into())
        );
        let path = dir.path().join("corrupt.sqlite");
        std::fs::write(&path, b"This is not a SQLite database").unwrap();
        assert_eq!(Queue::open(&path).err(), Some("unavailable".into()));
    }

    #[tokio::test]
    async fn failed_storage_reconfiguration_blocks_delivery_and_aborts_in_flight_requests() {
        for child_mode in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let mut queue = Queue::open(&dir.path().join("queue.sqlite")).unwrap();
            queue.set_child_mode(false, 100).unwrap();
            queue.enqueue(&request(), 100).unwrap();
            let task = tokio::spawn(std::future::pending::<()>());
            queue.in_flight = Some(task.abort_handle());
            // SQLite itself rejects cleanup writes, as with inaccessible storage.
            queue.db.execute_batch("PRAGMA query_only = ON").unwrap();
            assert_eq!(
                queue.set_child_mode(child_mode, 100),
                Err("unavailable".into())
            );
            assert!(task.await.unwrap_err().is_cancelled());
            assert!(queue.blocked);
            queue.db.execute_batch("PRAGMA query_only = OFF").unwrap();
            // Recovery of storage alone must not silently enable delivery or new signups.
            assert!(queue.due(100).unwrap().is_none());
            assert_eq!(queue.enqueue(&request(), 100), Err("invalid_input".into()));
            queue.set_child_mode(true, 100).unwrap();
            queue.set_child_mode(false, 100).unwrap();
            assert!(queue.due(100).unwrap().is_none());
        }
    }

    #[cfg(unix)]
    #[test]
    fn contact_database_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("queue.sqlite");
        let _queue = Queue::open(&path).unwrap();
        assert_eq!(
            std::fs::metadata(path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }

    fn signup() -> InterviewSignup {
        InterviewSignup {
            signup_id: Uuid::new_v4().to_string(),
            preferred_name: "  River  ".into(),
            email: "  river@example.invalid  ".into(),
            consent: true,
            consent_version: CONSENT_VERSION.into(),
        }
    }

    #[test]
    fn validates_and_trims_contact_details() {
        let mut input = signup();
        input.validate().unwrap();
        assert_eq!(input.preferred_name, "River");
        assert_eq!(input.email, "river@example.invalid");
    }

    #[test]
    fn rejects_invalid_contacts_or_missing_consent_without_echoing_input() {
        for update in [
            |s: &mut InterviewSignup| s.email = "private@example.invalid\nInjected".into(),
            |s: &mut InterviewSignup| s.email = "invalid".into(),
            |s: &mut InterviewSignup| s.preferred_name = " ".into(),
            |s: &mut InterviewSignup| s.preferred_name = "x".repeat(81),
            |s: &mut InterviewSignup| s.consent = false,
            |s: &mut InterviewSignup| s.consent_version = "unknown".into(),
            |s: &mut InterviewSignup| s.signup_id = "invalid".into(),
        ] {
            let mut input = signup();
            update(&mut input);
            assert_eq!(input.validate(), Err("invalid_input".into()));
        }
    }

    #[tokio::test]
    async fn sends_authenticated_contacts_to_interviews_endpoint_and_sanitizes_failures() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        for (status, retry_after, expected) in [
            (200, "", Delivery::Delivered),
            (400, "", Delivery::Rejected),
            (409, "", Delivery::Rejected),
            (401, "", Delivery::Unauthorized),
            (429, "", Delivery::Retry(3600)),
            (429, "Retry-After: 7200\r\n", Delivery::Retry(7200)),
            (503, "Retry-After: 300\r\n", Delivery::Retry(300)),
            (500, "", Delivery::Retry(0)),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut received = Vec::new();
                let mut buffer = [0u8; 4096];
                loop {
                    let n = stream.read(&mut buffer).unwrap();
                    received.extend_from_slice(&buffer[..n]);
                    if let Some(header_end) = received.windows(4).position(|w| w == b"\r\n\r\n") {
                        let headers =
                            String::from_utf8_lossy(&received[..header_end]).to_lowercase();
                        let length: usize = headers
                            .lines()
                            .find_map(|line| line.strip_prefix("content-length: "))
                            .unwrap()
                            .parse()
                            .unwrap();
                        if received.len() >= header_end + 4 + length {
                            break;
                        }
                    }
                    assert_ne!(n, 0);
                }
                let text = String::from_utf8(received).unwrap();
                let (headers, body) = text.split_once("\r\n\r\n").unwrap();
                assert!(headers.starts_with("POST /v1/interviews "));
                assert!(headers
                    .to_lowercase()
                    .contains("authorization: bearer syrv_tlm_test"));
                let body: serde_json::Value = serde_json::from_str(body).unwrap();
                assert_eq!(body.as_object().unwrap().len(), 5);
                assert_eq!(body["device_id"], "d91f63f7-02c7-43d8-a406-f5e7a08fb37f");
                assert_eq!(body["consent_version"], CONSENT_VERSION);
                assert!(body.get("consent").is_none());
                let body = "sensitive@example.invalid";
                write!(stream, "HTTP/1.1 {status} Status\r\n{retry_after}Content-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            });
            let request = SignupRequest {
                signup: signup(),
                device_id: "d91f63f7-02c7-43d8-a406-f5e7a08fb37f".into(),
            };
            let client = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap();
            assert_eq!(
                send_signup(
                    &client,
                    &format!("http://{address}/v1/interviews"),
                    &request,
                    "syrv_tlm_test",
                )
                .await,
                expected
            );
            server.join().unwrap();
        }
    }
}

//! Durable delivery for the optional About you survey, separate from the telemetry queue.
//!
//! Explicit sharing saves a single response in `onboarding-survey.sqlite` in app data.
//! A worker retries it across restarts for up to 30 days. A survey-only UUID identifies
//! the response; each edit increments its revision so retries cannot create duplicates
//! or let an old acknowledgment erase newer answers. Terminal delivery or expiry clears
//! the payload and retry metadata, retaining the UUID/revision receipt for later edits.
//!
//! Survey collection does not depend on telemetry preferences or age classification.
//! Operational diagnostics do respect telemetry preferences and contain only controlled
//! operation names/error codes, never answers, submission IDs, raw errors, or HTTP bodies.
//! Queue/network failures are nonfatal to onboarding. This file owns local persistence
//! and delivery; `survey_contract` owns the shared wire format and input validation.
use super::survey_contract::{SurveyAnswers, SurveyResponse};
use super::telemetry::telemetry_track_error;
use crate::utils::syrver::{syrver_url, ONBOARDING_SURVEY_PATH};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Notify;
/// Maximum pending-delivery lifetime assigned when a response is first queued or revised.
const LIFETIME: i64 = 30 * 86400;
/// UTC epoch seconds used for local expiry and retry scheduling.
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
/// Keep filesystem, SQLite, and serialization details out of the command error boundary.
fn unavailable(_: impl std::fmt::Display) -> String {
    "unavailable".into()
}
/// Single-slot persistent response and deduplication receipt; guarded by the manager mutex.
struct Queue {
    db: Connection,
}
impl Queue {
    /// Open/create the queue without changing an existing pending response.
    /// New Unix files are owner-only. Returns a controlled error if storage is unavailable.
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
        db.busy_timeout(Duration::from_secs(2))
            .map_err(unavailable)?;
        // Overwrite deleted database cells, use a transient rollback journal, and
        // synchronize commits for offline durability. These settings are not encryption
        // or a guarantee of erasure from filesystem snapshots/backups.
        // This schema is static SQL; all runtime values below use bound parameters.
        db.execute_batch(
            "PRAGMA secure_delete = ON;
             PRAGMA journal_mode = DELETE;
             PRAGMA synchronous = FULL;
             CREATE TABLE IF NOT EXISTS response (
                 slot INTEGER PRIMARY KEY CHECK (slot = 1),
                 id TEXT NOT NULL,
                 revision INTEGER NOT NULL,
                 payload TEXT,
                 expires INTEGER NOT NULL,
                 next_attempt INTEGER NOT NULL,
                 attempts INTEGER NOT NULL
             );",
        )
        .map_err(unavailable)?;
        Ok(Self { db })
    }
    /// Validate/normalize answers and atomically save them before returning success.
    /// Identical pending answers are a no-op; edits reuse the UUID with a new revision
    /// and restart the delivery lifetime. Rejects invalid input or unavailable storage.
    fn enqueue(&mut self, mut answers: SurveyAnswers, timestamp: i64) -> Result<(), String> {
        if !answers.validate() {
            return Err("invalid_input".into());
        }
        let transaction = self.db.transaction().map_err(unavailable)?;
        let previous: Option<(String, u32, Option<String>)> = transaction
            .query_row(
                "SELECT id, revision, payload FROM response WHERE slot=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(unavailable)?;
        let (id, revision) = if let Some((id, revision, payload)) = previous {
            if payload
                .and_then(|payload| serde_json::from_str::<SurveyResponse>(&payload).ok())
                .is_some_and(|response| response.answers == answers)
            {
                return Ok(());
            }
            (id, revision.checked_add(1).ok_or("unavailable")?)
        } else {
            (uuid::Uuid::new_v4().to_string(), 1)
        };
        let response = SurveyResponse {
            submission_id: id.clone(),
            schema_version: 1,
            revision,
            answers,
        };
        let payload = serde_json::to_string(&response).map_err(unavailable)?;
        transaction
            .execute(
                "INSERT OR REPLACE INTO response VALUES (1,?1,?2,?3,?4,?5,0)",
                params![id, revision, payload, timestamp + LIFETIME, timestamp],
            )
            .map_err(unavailable)?;
        transaction.commit().map_err(unavailable)
    }
    /// Clear expired payloads, then return a validated response whose retry time is due.
    /// Persist the next backoff (with jitter) before handing the response to the network,
    /// so restarting mid-request does not cause immediate repeated sends. Returns None
    /// when no response is due; storage or persisted-payload errors remain reportable.
    fn due(&self, timestamp: i64) -> Result<Option<SurveyResponse>, String> {
        self.db
            .execute(
                "UPDATE response SET payload=NULL, expires=0, next_attempt=0, attempts=0 WHERE payload IS NOT NULL AND expires<=?1",
                [timestamp],
            )
            .map_err(unavailable)?;
        let row: Option<(String, u32)> = self
            .db
            .query_row(
                "SELECT payload, attempts FROM response
                 WHERE payload IS NOT NULL AND next_attempt <= ?1",
                [timestamp],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(unavailable)?;
        let Some((payload, attempts)) = row else {
            return Ok(None);
        };
        let mut response: SurveyResponse = serde_json::from_str(&payload).map_err(unavailable)?;
        if !response.validate() {
            return Err("invalid_input".into());
        }
        let delay = (30i64 * (1i64 << attempts.min(10))).min(21600);
        let delay = delay + i64::from(rand::random::<u32>()) % (delay / 4 + 1);
        self.db
            .execute(
                "UPDATE response SET attempts=attempts+1,next_attempt=?1",
                [timestamp + delay],
            )
            .map_err(unavailable)?;
        Ok(Some(response))
    }
    /// Apply a delivery result only to its revision; a newer share may already be queued.
    /// None clears terminal payloads but preserves the receipt. Some(delay) extends the
    /// scheduled retry when the server asks for a longer wait. Storage errors propagate.
    fn finish(&self, revision: u32, retry: Option<i64>, timestamp: i64) -> Result<(), String> {
        match retry {
            None => self.db.execute(
                "UPDATE response SET payload=NULL, expires=0, next_attempt=0, attempts=0 WHERE revision=?1",
                [revision],
            ),
            Some(delay) => self.db.execute(
                "UPDATE response SET next_attempt=MAX(next_attempt,?1) WHERE revision=?2",
                params![timestamp.saturating_add(delay), revision],
            ),
        }
        .map_err(unavailable)?;
        Ok(())
    }
}
/// App-lifetime queue owner; initialization starts at most one background worker.
#[derive(Default)]
pub struct SurveyManager {
    queue: Mutex<Option<Queue>>,
    started: AtomicBool,
    wake: Notify,
}
/// Open storage lazily and wake/start delivery without awaiting the network.
/// Initialization failures propagate to the command caller for nonfatal reporting.
fn initialize(app: &AppHandle, manager: &SurveyManager) -> Result<(), String> {
    let mut guard = manager.queue.lock().map_err(unavailable)?;
    if guard.is_none() {
        let directory = app.path().app_data_dir().map_err(unavailable)?;
        std::fs::create_dir_all(&directory).map_err(unavailable)?;
        *guard = Some(Queue::open(&directory.join("onboarding-survey.sqlite"))?);
    }
    drop(guard);
    if !manager.started.swap(true, Ordering::SeqCst) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut queue_error_reported = false;
            loop {
                let manager = app.state::<SurveyManager>();
                tokio::select! { _ = manager.wake.notified() => {}, _ = tokio::time::sleep(Duration::from_secs(15)) => {} }
                let response = manager.queue.lock().map_err(unavailable).and_then(|guard| {
                    guard
                        .as_ref()
                        .ok_or_else(|| "unavailable".to_string())?
                        .due(now())
                });
                let response = match response {
                    Ok(response) => {
                        queue_error_reported = false;
                        response
                    }
                    Err(_) => {
                        // One report per continuous failure, rather than every 15-second poll.
                        if !queue_error_reported {
                            report_failure(&app, "survey_read_queue", "unavailable");
                            queue_error_reported = true;
                        }
                        continue;
                    }
                };
                let Some(response) = response else {
                    continue;
                };
                let retry = deliver(&app, &response).await;
                let finished = manager.queue.lock().map_err(unavailable).and_then(|guard| {
                    guard
                        .as_ref()
                        .ok_or_else(|| "unavailable".to_string())?
                        .finish(response.revision, retry, now())
                });
                if finished.is_err() {
                    report_failure(&app, "survey_finish_delivery", "unavailable");
                }
            }
        });
    }
    manager.wake.notify_one();
    Ok(())
}
/// Report controlled diagnostics through the existing consent-gated error pipeline.
/// Never pass raw storage/network errors or response data. Telemetry failures are ignored
/// to avoid recursion; diagnostics do not change queue state or delivery eligibility.
fn report_failure(app: &AppHandle, operation: &'static str, code: &'static str) {
    eprintln!("Survey operation failed: {operation} ({code})");
    let _ = telemetry_track_error(
        "app.error".into(),
        "Survey operation failed.".into(),
        serde_json::json!({"operation": operation, "code": code}),
        app.state(),
    );
}

/// Attempt one unauthenticated survey POST, with a timeout and no redirect following.
/// None means success or permanent rejection; Some(delay) means retry, honoring bounded
/// Retry-After hints on top of the queue's backoff. Only controlled failures are reported;
/// response bodies are never read into diagnostics. The caller finalizes queue state.
async fn deliver(app: &AppHandle, response: &SurveyResponse) -> Option<i64> {
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    else {
        report_failure(app, "survey_deliver", "client_unavailable");
        return Some(0);
    };
    let Ok(result) = client
        .post(syrver_url(ONBOARDING_SURVEY_PATH))
        .json(response)
        .send()
        .await
    else {
        report_failure(app, "survey_deliver", "request_failed");
        return Some(0);
    };
    let delay = result
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            value.parse::<i64>().ok().or_else(|| {
                chrono::DateTime::parse_from_rfc2822(value)
                    .ok()
                    .map(|date| date.timestamp().saturating_sub(now()))
            })
        })
        .unwrap_or(0)
        .clamp(0, LIFETIME);
    match result.status().as_u16() {
        200..=299 => None,
        408 | 429 | 500..=599 => {
            report_failure(app, "survey_deliver", "retryable_response");
            Some(delay)
        }
        _ => {
            report_failure(app, "survey_deliver", "rejected_response");
            None
        }
    }
}
/// Resume pending delivery at startup; errors are reported by the frontend wrapper.
#[tauri::command]
pub fn survey_init(app: AppHandle, state: State<'_, SurveyManager>) -> Result<(), String> {
    initialize(&app, &state)
}
/// Save explicitly shared answers durably, then wake asynchronous delivery.
/// Success means queued locally, not accepted by the server. Returns only controlled
/// invalid_input/unavailable errors; the frontend reports them without blocking onboarding.
#[tauri::command]
pub fn survey_submit(
    app: AppHandle,
    answers: SurveyAnswers,
    state: State<'_, SurveyManager>,
) -> Result<(), String> {
    initialize(&app, &state)?;
    state
        .queue
        .lock()
        .map_err(unavailable)?
        .as_mut()
        .ok_or("unavailable")?
        .enqueue(answers, now())?;
    state.wake.notify_one();
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn answers(goal: &str) -> SurveyAnswers {
        SurveyAnswers {
            goals: vec![goal.into()],
            ..Default::default()
        }
    }
    #[test]
    fn other_text_survives_retry_and_edits_replace_the_same_submission() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("survey.sqlite");
        let mut queue = Queue::open(&path).unwrap();
        let mut answers = answers("something_else");
        answers.goals_other = Some("  中文 conversation  ".into());
        queue.enqueue(answers.clone(), 100).unwrap();
        let first = queue.due(100).unwrap().unwrap();
        assert_eq!(
            first.answers.goals_other.as_deref(),
            Some("中文 conversation")
        );
        answers.goals_other = Some("中文 conversation".into());
        queue.enqueue(answers.clone(), 101).unwrap();
        queue.finish(first.revision, Some(60), 100).unwrap();
        assert!(queue.due(159).unwrap().is_none());
        drop(queue);
        let mut queue = Queue::open(&path).unwrap();
        let retry = queue.due(160).unwrap().unwrap();
        assert!(retry == first);
        answers.goals_other = Some("Read menus".into());
        queue.enqueue(answers, 161).unwrap();
        queue.finish(first.revision, None, 161).unwrap();
        let edited = queue.due(161).unwrap().unwrap();
        assert_eq!(edited.submission_id, first.submission_id);
        assert_eq!(edited.revision, 2);
        assert_eq!(edited.answers.goals_other.as_deref(), Some("Read menus"));
    }
    #[test]
    fn revisions_survive_restart_and_old_acknowledgments_cannot_erase_edits() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("survey.sqlite");
        let mut queue = Queue::open(&path).unwrap();
        queue.enqueue(answers("read_chinese"), 100).unwrap();
        let first = queue.due(100).unwrap().unwrap();
        queue.enqueue(answers("read_chinese"), 101).unwrap();
        assert!(queue.due(101).unwrap().is_none());
        queue.enqueue(answers("build_vocabulary"), 102).unwrap();
        queue.finish(first.revision, None, 102).unwrap();
        drop(queue);
        let queue = Queue::open(&path).unwrap();
        let second = queue.due(102).unwrap().unwrap();
        assert_eq!(first.submission_id, second.submission_id);
        assert_eq!(second.revision, 2);
        assert!(queue.due(102 + LIFETIME).unwrap().is_none());
    }
}

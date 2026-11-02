//! Explicit unlinked survey delivery, independent of telemetry and age classification.
use super::survey_contract::{SurveyAnswers, SurveyResponse};
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
const LIFETIME: i64 = 30 * 86400;
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn unavailable(_: impl std::fmt::Display) -> String {
    "unavailable".into()
}
struct Queue {
    db: Connection,
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
        db.busy_timeout(Duration::from_secs(2))
            .map_err(unavailable)?;
        db.execute_batch("PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS response (slot INTEGER PRIMARY KEY CHECK(slot=1), id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, expires INTEGER NOT NULL, next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL);").map_err(unavailable)?;
        Ok(Self { db })
    }
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
    fn due(&self, timestamp: i64) -> Result<Option<SurveyResponse>, String> {
        self.db
            .execute(
                "UPDATE response SET payload=NULL, expires=0, next_attempt=0, attempts=0 WHERE payload IS NOT NULL AND expires<=?1",
                [timestamp],
            )
            .map_err(unavailable)?;
        let row: Option<(String,u32)> = self.db.query_row("SELECT payload,attempts FROM response WHERE payload IS NOT NULL AND next_attempt<=?1",[timestamp],|row|Ok((row.get(0)?,row.get(1)?))).optional().map_err(unavailable)?;
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
    // Clear only the acknowledged revision: a newer explicit share may already be queued.
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
#[derive(Default)]
pub struct SurveyManager {
    queue: Mutex<Option<Queue>>,
    started: AtomicBool,
    wake: Notify,
}
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
            loop {
                let manager = app.state::<SurveyManager>();
                tokio::select! { _ = manager.wake.notified() => {}, _ = tokio::time::sleep(Duration::from_secs(15)) => {} }
                let response = manager.queue.lock().ok().and_then(|guard| {
                    guard
                        .as_ref()
                        .and_then(|queue| queue.due(now()).ok().flatten())
                });
                let Some(response) = response else {
                    continue;
                };
                let retry = deliver(&response).await;
                if let Ok(guard) = manager.queue.lock() {
                    if let Some(queue) = guard.as_ref() {
                        let _ = queue.finish(response.revision, retry, now());
                    }
                };
            }
        });
    }
    manager.wake.notify_one();
    Ok(())
}
async fn deliver(response: &SurveyResponse) -> Option<i64> {
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    else {
        return Some(0);
    };
    let Ok(result) = client
        .post(syrver_url(ONBOARDING_SURVEY_PATH))
        .json(response)
        .send()
        .await
    else {
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
        408 | 429 | 500..=599 => Some(delay),
        _ => None,
    }
}
#[tauri::command]
pub fn survey_init(app: AppHandle, state: State<'_, SurveyManager>) -> Result<(), String> {
    initialize(&app, &state)
}
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

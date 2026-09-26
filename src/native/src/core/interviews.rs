//! Explicit interview signups. Contact details never pass through the telemetry queue.

use crate::core::TelemetryManager;
use crate::utils::syrver::{syrver_url, INTERVIEW_SIGNUPS_PATH};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::State;
use uuid::Uuid;

const CONSENT_VERSION: &str = "interviews-v1";

#[derive(Deserialize, Serialize)]
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

#[derive(Serialize)]
struct SignupRequest {
    #[serde(flatten)]
    signup: InterviewSignup,
    device_id: String,
}

async fn send_signup(url: &str, request: &SignupRequest) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "unavailable".to_string())?;
    let response = client
        .post(url)
        .json(request)
        .send()
        .await
        .map_err(|_| "unavailable".to_string())?;
    // Do not read or log the response body: it may echo submitted contact details.
    match response.status().as_u16() {
        200 => Ok(()),
        400 | 409 | 413 => Err("invalid_input".to_string()),
        429 => Err("rate_limited".to_string()),
        _ => Err("unavailable".to_string()),
    }
}

#[tauri::command]
pub async fn interview_signup(
    mut signup: InterviewSignup,
    state: State<'_, TelemetryManager>,
) -> Result<(), String> {
    signup.validate()?;
    let request = SignupRequest {
        signup,
        device_id: state.interview_device_id()?,
    };
    send_signup(&syrver_url(INTERVIEW_SIGNUPS_PATH), &request).await
}

#[cfg(test)]
mod tests {
    use super::*;

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
    async fn sends_contacts_only_to_signup_endpoint_and_sanitizes_failures() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        for (status, expected) in [
            (200, Ok(())),
            (429, Err("rate_limited".into())),
            (500, Err("unavailable".into())),
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
                assert!(text.starts_with("POST /v1/interview-signups "));
                assert!(text.contains("\"device_id\":\"test-device\""));
                assert!(!text.to_lowercase().contains("authorization:"));
                let body = "sensitive@example.invalid";
                write!(stream, "HTTP/1.1 {status} Status\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            });
            let request = SignupRequest {
                signup: signup(),
                device_id: "test-device".into(),
            };
            assert_eq!(
                send_signup(&format!("http://{address}/v1/interview-signups"), &request).await,
                expected
            );
            server.join().unwrap();
        }
    }
}

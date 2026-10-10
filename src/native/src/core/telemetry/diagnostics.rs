//! Error privacy policy. Raw context may cross local IPC, but only this allowlisted,
//! redacted representation may be retained in the queue or sent to the backend.

use crate::utils::syrver::{
    INTERVIEWS_PATH, SYRVER_LOCAL_BASE_URL, SYRVER_PRODUCTION_BASE_URL, TELEMETRY_EVENTS_PATH,
    TELEMETRY_INSTALLATIONS_PATH,
};
use regex::Regex;
use reqwest::Url;
use serde::Serialize;
use serde_json::{Map, Value};
use std::sync::LazyLock;

const MAX_TEXT_CHARS: usize = 8_000;
const MAX_DEPTH: usize = 16;
const MAX_CAUSES: usize = 5;
const FIELDS: &[&str] = &[
    "error_name",
    "error_message",
    "error_reason",
    "error_stack",
    "operation",
    "visibility_state",
    "ms_since_foreground",
    "code",
    "status",
    "stage",
    "duration_ms",
    "online",
    "trigger",
    "timeout_ms",
    "service",
    "occurrence_count",
    "summary",
];
const CAUSE_FIELDS: &[&str] = &[
    "error_name",
    "error_message",
    "error_reason",
    "error_stack",
    "code",
    "status",
];

static PRIVATE_FIELD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)text|query|word|lexical|list|document|title|notes|password|token|secret|authorization|path|url|filename").unwrap()
});
static URL_OR_CREDENTIAL: LazyLock<Regex> = LazyLock::new(|| {
    // Credentials that contain URLs must be consumed in full before considering
    // URL exceptions (for example, password='words https://host.test more words').
    Regex::new(&format!(
        r#"(?:{})|(?:{})|(?P<url>(?i:\b[a-z][a-z0-9+.-]*://[^\s)"'<>]+))"#,
        REDACTIONS[0].0.as_str(),
        REDACTIONS[1].0.as_str(),
    ))
    .unwrap()
});
static UPDATE_ROUTE: LazyLock<Regex> = LazyLock::new(|| {
    // Only public release coordinates, never arbitrary path segments or prerelease labels.
    Regex::new(r"^/v1/updates/stable/(darwin|linux|windows)/(aarch64|x86_64|i686|armv7)/[0-9]+\.[0-9]+\.[0-9]+$").unwrap()
});
static BUNDLED_SCRIPT: LazyLock<Regex> = LazyLock::new(|| {
    // Match the entry points and hashed chunks emitted by vite.config.js.
    Regex::new(
        r"^/templates/build/(?:bundle|splash-init|assets/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8})\.js$",
    )
    .unwrap()
});
static STACK_LOCATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r":[0-9]+(?::[0-9]+)?$").unwrap());
static REDACTIONS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"(?i)\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+", "[redacted credential]"),
        (r#"(?i)\b(?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,"'}]+)"#, "[redacted credential]"),
        (r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[redacted email]"),
        (r#"(?:[A-Za-z]:\\|\\\\|/(?:Users|home|private|tmp|var|Volumes)/)[^\n)"']+|/(?:[A-Za-z0-9_.~-]+/)+[^\s)"']*"#, "[redacted path]"),
        (r"(?i)\b\d+:(?:[0-9a-f]{64}|[a-z][a-z0-9_-]+)\b", "[redacted lexical ID]"),
    ]
    .into_iter()
    .map(|(pattern, replacement)| (Regex::new(pattern).unwrap(), replacement))
    .collect()
});

#[derive(Debug, Serialize)]
pub struct SanitizedDiagnostics {
    pub name: String,
    pub message: String,
    pub payload: Map<String, Value>,
}

fn collect_private(value: &Value, private: bool, depth: usize, values: &mut Vec<String>) -> bool {
    if depth > MAX_DEPTH {
        return false;
    }
    match value {
        Value::String(text) if private && !text.is_empty() => values.push(text.clone()),
        Value::Array(children) => {
            for child in children {
                if !collect_private(child, private, depth + 1, values) {
                    return false;
                }
            }
        }
        Value::Object(fields) => {
            for (key, child) in fields {
                if !collect_private(
                    child,
                    private || PRIVATE_FIELD.is_match(key),
                    depth + 1,
                    values,
                ) {
                    return false;
                }
            }
        }
        _ => {}
    }
    true
}

fn redact_prose(text: &str, private_values: &[String]) -> String {
    let mut redacted = text.to_owned();
    for private in private_values {
        redacted = redacted.replace(private, "[redacted]");
    }
    for (pattern, replacement) in REDACTIONS.iter() {
        redacted = pattern.replace_all(&redacted, *replacement).into_owned();
    }
    redacted
}

fn diagnostic_url(text: &str) -> Option<String> {
    let mut url = Url::parse(text).ok()?;
    url.set_username("").ok()?;
    url.set_password(None).ok()?;
    url.set_query(None);
    url.set_fragment(None);

    for base in [SYRVER_PRODUCTION_BASE_URL, SYRVER_LOCAL_BASE_URL] {
        let base_url = Url::parse(base).ok()?;
        if url.origin() != base_url.origin() {
            continue;
        }
        let route = url
            .path()
            .strip_prefix(base_url.path().trim_end_matches('/'))?;
        if [
            TELEMETRY_EVENTS_PATH,
            TELEMETRY_INSTALLATIONS_PATH,
            INTERVIEWS_PATH,
        ]
        .contains(&route)
            || UPDATE_ROUTE.is_match(route)
        {
            return Some(url.to_string());
        }
    }

    let bundled_origin = matches!(
        (url.scheme(), url.host_str(), url.port()),
        ("tauri", Some("localhost"), None) | ("http" | "https", Some("tauri.localhost"), None)
    );
    if bundled_origin {
        // A stack location can follow the path, query, or fragment. Keep only its digits.
        let location = STACK_LOCATION
            .find(text)
            .map_or("", |location| location.as_str());
        let script_path = STACK_LOCATION.replace(url.path(), "");
        if BUNDLED_SCRIPT.is_match(&script_path) {
            let script_path = script_path.into_owned();
            url.set_path(&script_path);
            // Keep the app origin so the queue's second sanitization pass recognizes it.
            return Some(format!("{url}{location}"));
        }
    }
    None
}

fn redact(text: &str, private_values: &[String]) -> String {
    let mut text = text.to_owned();
    for private in private_values {
        text = text.replace(private, "[redacted]");
    }
    // Process URLs separately so generic path rules cannot erase approved routes or
    // script locations. No placeholders: user text cannot impersonate an approved URL.
    let mut redacted = String::new();
    let mut previous_end = 0;
    for captures in URL_OR_CREDENTIAL.captures_iter(&text) {
        let matched = captures.get(0).unwrap();
        redacted.push_str(&redact_prose(
            &text[previous_end..matched.start()],
            private_values,
        ));
        if let Some(url) = captures.name("url") {
            redacted
                .push_str(&diagnostic_url(url.as_str()).unwrap_or_else(|| "[redacted URL]".into()));
        } else {
            redacted.push_str("[redacted credential]");
        }
        previous_end = matched.end();
    }
    redacted.push_str(&redact_prose(&text[previous_end..], private_values));
    // Explicit private context always wins, including inside otherwise approved URLs.
    for private in private_values {
        redacted = redacted.replace(private, "[redacted]");
    }
    redacted.chars().take(MAX_TEXT_CHARS).collect()
}

fn allow_fields(value: &Value, fields: &[&str], private_values: &[String]) -> Map<String, Value> {
    fields
        .iter()
        .filter_map(|key| {
            let value = match value.get(*key)? {
                Value::String(text) => Value::String(redact(text, private_values)),
                value @ (Value::Number(_) | Value::Bool(_)) => value.clone(),
                _ => return None,
            };
            Some(((*key).to_owned(), value))
        })
        .collect()
}

pub fn sanitize(name: &str, message: &str, payload: &Value) -> SanitizedDiagnostics {
    let mut private_values = Vec::new();
    let mut complete = collect_private(payload, false, 0, &mut private_values);
    // Older JS callers serialize error objects. These are discovery-only, never output fields.
    if let Some(serialized) = payload.get("error_payload").and_then(Value::as_str) {
        if let Ok(decoded) = serde_json::from_str::<Value>(serialized) {
            complete &= collect_private(&decoded, false, 0, &mut private_values);
        }
    }
    if !complete {
        // Do not retain prose if deeply nested context prevented private-value discovery.
        return SanitizedDiagnostics {
            name: "app.error".into(),
            message: "Diagnostic context exceeded depth limit".into(),
            payload: Map::new(),
        };
    }
    private_values.sort_by_key(|value| std::cmp::Reverse(value.len()));
    private_values.dedup();
    let mut safe_payload = allow_fields(payload, FIELDS, &private_values);
    if let Some(causes) = payload.get("error_causes").and_then(Value::as_array) {
        safe_payload.insert(
            "error_causes".into(),
            Value::Array(
                causes
                    .iter()
                    .take(MAX_CAUSES)
                    .map(|cause| Value::Object(allow_fields(cause, CAUSE_FIELDS, &private_values)))
                    .collect(),
            ),
        );
    }
    SanitizedDiagnostics {
        name: redact(name, &private_values),
        message: redact(message, &private_values),
        payload: safe_payload,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn preserves_service_routes_without_credentials_queries_or_fragments() {
        for base in [SYRVER_PRODUCTION_BASE_URL, SYRVER_LOCAL_BASE_URL] {
            for route in [
                "/v1/updates/stable/darwin/aarch64/2.5.2",
                "/v1/updates/stable/linux/x86_64/2.5.2",
                "/v1/updates/stable/windows/i686/2.5.2",
                TELEMETRY_EVENTS_PATH,
                TELEMETRY_INSTALLATIONS_PATH,
                INTERVIEWS_PATH,
            ] {
                let expected = format!("{base}{route}");
                let mut url = Url::parse(&expected).unwrap();
                url.set_username("alice").unwrap();
                url.set_password(Some("private-password")).unwrap();
                url.set_query(Some("token=private-token&query=private-query"));
                url.set_fragment(Some("private-fragment"));
                let safe = sanitize(
                    "app.error",
                    &format!("request failed ({url})"),
                    &json!({
                        "error_causes": [{"error_message": format!("request failed ({url})")}]
                    }),
                );
                assert_eq!(safe.message, format!("request failed ({expected})"));
                assert_eq!(
                    safe.payload["error_causes"][0]["error_message"],
                    safe.message
                );
            }
        }
    }

    #[test]
    fn rejects_unknown_origins_routes_and_private_path_segments() {
        for url in [
            "https://example.test/v1/updates/stable/darwin/aarch64/2.5.2",
            "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com.evil.test/production/v1/telemetry",
            "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com@evil.test/production/v1/telemetry",
            "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com:444/production/v1/telemetry",
            "http://localhost:8788/v1/telemetry",
            "http://localhost:8787/v1/telemetry/private-user",
            "http://localhost:8787/v1/updates/private-channel/darwin/aarch64/2.5.2",
            "http://localhost:8787/v1/updates/stable/private-user/aarch64/2.5.2",
            "http://localhost:8787/v1/updates/stable/darwin/aarch64/2.5.2-private-label",
            "http://localhost:8787/v1/updates/stable/darwin/aarch64/2.5.2/private-user",
            "http://localhost:8787/v1/updates/stable/darwin/aarch64/%32.5.2",
            "file:///Users/alice/private.js:2:3",
            "tauri://localhost/templates/private.js:2:3",
            "tauri://localhost/templates/build/private.js:2:3",
            "https://example.test/templates/build/bundle.js:2:3",
        ] {
            assert_eq!(redact(url, &[]), "[redacted URL]", "{url}");
        }
    }

    #[test]
    fn preserves_bundled_stack_locations_and_redacts_neighboring_private_data() {
        for origin in [
            "tauri://localhost",
            "https://tauri.localhost",
            "http://tauri.localhost",
        ] {
            for script in [
                "bundle.js",
                "splash-init.js",
                "assets/reader.svelte-CbDqxujL.js",
            ] {
                for suffix in [
                    ":12:345",
                    "?token=private-token:12:345",
                    "#private-fragment:12:345",
                ] {
                    let stack = format!("Error\npi@{origin}/templates/build/{script}{suffix}\n at open (/Users/alice/private.db:2:3)\n at fetch (https://private.test/book)");
                    let safe = sanitize("app.error", "failure", &json!({"error_stack": stack}));
                    assert_eq!(safe.payload["error_stack"], format!("Error\npi@{origin}/templates/build/{script}:12:345\n at open ([redacted path])\n at fetch ([redacted URL])"));
                    let persisted = sanitize(&safe.name, &safe.message, &json!(safe.payload));
                    assert_eq!(persisted.payload, safe.payload);
                }
            }
        }
    }

    #[test]
    fn explicit_private_context_overrides_url_exceptions() {
        let url = format!("{SYRVER_PRODUCTION_BASE_URL}/v1/updates/stable/darwin/aarch64/2.5.2");
        let safe = sanitize("app.error", &format!("failed {url}"), &json!({"url": url}));
        assert_eq!(safe.message, "failed [redacted]");
        let private = format!("private title {url} more private words");
        let safe = sanitize("app.error", &private, &json!({"title": private}));
        assert_eq!(safe.message, "[redacted]");
    }

    #[test]
    fn redacts_entire_credentials_containing_urls() {
        for url in [
            "https://private.test/book",
            "http://localhost:8787/v1/telemetry",
        ] {
            for quote in ["'", "\""] {
                let message =
                    format!("failed password={quote}private words {url} more secrets{quote}");
                assert_eq!(redact(&message, &[]), "failed [redacted credential]");
            }
        }
    }

    #[test]
    fn redacts_prose_and_never_returns_discovery_context() {
        let safe = sanitize(
            "app.error",
            "Cannot open My Secret List",
            &json!({
                "operation": "getListContent",
                "error_message": "My Secret List password=hunter2 Bearer abc.def",
                "error_stack": "Error\n at load (/Users/alice/private.txt:2:3)\n at fetch (https://example.test/private?q=secret)",
                "error_payload": r#"{"list":"My Secret List","nested":{"notes":"personal notes"}}"#,
                "query": "你好", "lexical_id": "1:secret-entry", "nested": {"token": "abc.def"},
                "ms_since_foreground": 25, "occurrence_count": 3, "summary": true
            }),
        );
        let serialized = serde_json::to_string(&safe).unwrap();
        for private in [
            "My Secret List",
            "hunter2",
            "abc.def",
            "alice",
            "example.test",
            "你好",
            "secret-entry",
            "personal notes",
            "error_payload",
        ] {
            assert!(!serialized.contains(private), "{private}");
        }
        assert!(serialized.contains("getListContent"));
        assert!(serialized.contains("at load"));
        assert_eq!(safe.payload["occurrence_count"], 3);
        assert_eq!(safe.payload["summary"], true);
    }

    #[test]
    fn redacts_paths_credentials_email_and_lexical_ids() {
        for private in [
            r"C:\Users\Alice\private.db",
            r"\\server\share\file",
            "/home/alice/private.txt",
            "/assets/private/file.txt",
            "alice@example.test",
            "Bearer abc.def",
            "password='multiple secret words'",
            "1:secret-entry",
        ] {
            let safe = sanitize("app.error", private, &json!({"code": "DB_CLOSED"}));
            assert!(
                safe.message.starts_with("[redacted"),
                "{private}: {}",
                safe.message
            );
            assert_eq!(safe.payload["code"], "DB_CLOSED");
        }
    }

    #[test]
    fn bounds_causes_and_redacts_their_private_context() {
        let cause = json!({
            "error_name": "NativeError", "error_message": "private book https://host.test/?token=abc",
            "code": "ECONNREFUSED", "status": 503, "document_title": "private book",
            "headers": {"authorization": "abc.def"}
        });
        let safe = sanitize(
            "app.error",
            "Cannot open private book",
            &json!({
                "error_causes": vec![cause; 10], "duration_ms": 123, "stage": "check", "online": false
            }),
        );
        assert_eq!(
            safe.payload["error_causes"].as_array().unwrap().len(),
            MAX_CAUSES
        );
        assert_eq!(safe.payload["error_causes"][0]["code"], "ECONNREFUSED");
        assert_eq!(safe.payload["error_causes"][0]["status"], 503);
        assert_eq!(safe.payload["online"], false);
        let serialized = serde_json::to_string(&safe).unwrap();
        for private in [
            "private book",
            "host.test",
            "abc.def",
            "headers",
            "authorization",
        ] {
            assert!(!serialized.contains(private), "{private}");
        }
    }

    #[test]
    fn preserves_reasons_and_nested_stacks_with_private_values_redacted() {
        let safe = sanitize(
            "app.error",
            "Please restart Syng.",
            &json!({
                "error_reason": "Cannot open private book",
                "error_causes": [{
                    "error_name": "DatabaseError",
                    "error_reason": "Permission denied for private book at https://host.test/db",
                    "error_stack": "Error\n at open (/Users/alice/private.db:2:3)",
                    "document_title": "private book"
                }]
            }),
        );
        assert_eq!(safe.payload["error_reason"], "Cannot open [redacted]");
        assert_eq!(
            safe.payload["error_causes"][0]["error_reason"],
            "Permission denied for [redacted] at [redacted URL]"
        );
        assert_eq!(
            safe.payload["error_causes"][0]["error_stack"],
            "Error\n at open ([redacted path])"
        );
        assert!(safe.payload["error_causes"][0]
            .get("document_title")
            .is_none());
    }

    #[test]
    fn caps_unicode_prose_and_rejects_excessively_deep_context() {
        let safe = sanitize("app.error", &"字".repeat(MAX_TEXT_CHARS + 1), &json!({}));
        assert_eq!(safe.message.chars().count(), MAX_TEXT_CHARS);
        let mut nested = json!({"query": "private"});
        for _depth in 0..=MAX_DEPTH {
            nested = json!({"nested": nested});
        }
        let safe = sanitize("private", "private", &nested);
        assert_eq!(safe.name, "app.error");
        assert!(safe.payload.is_empty());
        assert!(!safe.message.contains("private"));
    }
}

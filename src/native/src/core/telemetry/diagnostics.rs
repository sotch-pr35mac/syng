//! Error privacy policy. Raw context may cross local IPC, but only this allowlisted,
//! redacted representation may be retained in the queue or sent to the backend.

use regex::Regex;
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
static REDACTIONS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"(?i)\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+", "[redacted credential]"),
        (r#"(?i)\b(?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,"'}]+)"#, "[redacted credential]"),
        (r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[redacted email]"),
        (r#"(?i)\b[a-z][a-z0-9+.-]*://[^\s)"']+"#, "[redacted URL]"),
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

fn redact(text: &str, private_values: &[String]) -> String {
    let mut redacted = text.to_owned();
    for private in private_values {
        redacted = redacted.replace(private, "[redacted]");
    }
    for (pattern, replacement) in REDACTIONS.iter() {
        redacted = pattern.replace_all(&redacted, *replacement).into_owned();
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

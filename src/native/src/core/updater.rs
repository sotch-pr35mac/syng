//! Preserve updater errors before the plugin's IPC serializer flattens them to a string.
//! Download/install still use the plugin's resources and signature verification.

use crate::core::network::NetworkStatus;
use serde::Serialize;
#[cfg(any(not(feature = "mas"), test))]
use std::error::Error as StdError;
#[cfg(not(feature = "mas"))]
use tauri::Manager;
use tauri::{ResourceId, State, Webview};
#[cfg(not(feature = "mas"))]
use tauri_plugin_updater::UpdaterExt;

#[cfg(any(not(feature = "mas"), test))]
const MAX_CAUSES: usize = 5;
#[cfg(any(not(feature = "mas"), test))]
const MAX_MESSAGE_CHARS: usize = 2_000;

#[derive(Debug, Serialize)]
pub struct UpdateFailure {
    name: &'static str,
    message: String,
    code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cause: Option<Box<UpdateCause>>,
}

#[derive(Debug, Serialize)]
struct UpdateCause {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cause: Option<Box<UpdateCause>>,
}

#[cfg(any(not(feature = "mas"), test))]
fn error_cause(error: Option<&(dyn StdError + 'static)>, depth: usize) -> Option<Box<UpdateCause>> {
    if depth >= MAX_CAUSES {
        return None;
    }
    error.map(|error| {
        Box::new(UpdateCause {
            message: error.to_string().chars().take(MAX_MESSAGE_CHARS).collect(),
            cause: error_cause(error.source(), depth + 1),
        })
    })
}

#[cfg(any(not(feature = "mas"), test))]
fn describe_failure(error: tauri_plugin_updater::Error) -> UpdateFailure {
    use tauri_plugin_updater::Error;
    let (code, status) = match &error {
        Error::Reqwest(network) => (
            if network.is_timeout() {
                "timeout"
            } else if network.is_connect() {
                "connect"
            } else if network.is_decode() {
                "response_decode"
            } else if network.is_status() {
                "http_status"
            } else {
                "request"
            },
            network.status().map(|status| status.as_u16()),
        ),
        // The upstream plugin discards the status on non-success HTTP responses.
        // Do not invent a status or make an additional diagnostic network request.
        Error::ReleaseNotFound => ("release_unavailable", None),
        Error::Serialization(_) | Error::Semver(_) => ("invalid_manifest", None),
        Error::TargetNotFound(_) | Error::TargetsNotFound(_) => ("target_missing", None),
        Error::EmptyEndpoints | Error::InsecureTransportProtocol | Error::UrlParse(_) => {
            ("configuration", None)
        }
        Error::Io(_) => ("io", None),
        _ => ("updater", None),
    };
    UpdateFailure {
        name: "UpdaterError",
        message: error.to_string().chars().take(MAX_MESSAGE_CHARS).collect(),
        code,
        status,
        cause: error_cause(error.source(), 0),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[tauri::command]
pub async fn check_for_update(
    webview: Webview,
    network_status: State<'_, NetworkStatus>,
) -> Result<Option<UpdateMetadata>, UpdateFailure> {
    if !network_status.is_online() {
        return Ok(None);
    }
    #[cfg(feature = "mas")]
    {
        let _ = webview;
        // MAS builds must never attempt a self-update, including through direct IPC.
        Ok(None)
    }
    #[cfg(not(feature = "mas"))]
    {
        let updater = webview.updater().map_err(describe_failure)?;
        let Some(update) = updater.check().await.map_err(describe_failure)? else {
            return Ok(None);
        };
        let mut metadata = UpdateMetadata {
            rid: 0,
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            date: update
                .raw_json
                .get("pub_date")
                .and_then(|date| date.as_str())
                .map(str::to_owned),
            body: update.body.clone(),
            raw_json: update.raw_json.clone(),
        };
        metadata.rid = webview.resources_table().add(update);
        Ok(Some(metadata))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distinguishes_invalid_manifest_and_unknown_release_status() {
        let invalid = serde_json::from_str::<serde_json::Value>("not json").unwrap_err();
        let failure = describe_failure(invalid.into());
        assert_eq!(failure.code, "invalid_manifest");
        assert!(!failure.message.is_empty());
        let unavailable = describe_failure(tauri_plugin_updater::Error::ReleaseNotFound);
        assert_eq!(unavailable.code, "release_unavailable");
        assert_eq!(unavailable.status, None);
    }

    #[test]
    fn preserves_bounded_source_details() {
        let source = std::io::Error::other("connection refused");
        let cause = error_cause(Some(&source), 0).unwrap();
        assert_eq!(cause.message, "connection refused");
        assert!(error_cause(Some(&source), MAX_CAUSES).is_none());
    }
}
